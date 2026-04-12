"""Session management — tracks PnL, drawdown, and circuit breakers."""

import time
import uuid
from typing import Optional
try:
    from lib.models import SessionMetrics, ExecutedTrade, TradePreferences, OpenPosition
except ModuleNotFoundError:
    from models import SessionMetrics, ExecutedTrade, TradePreferences, OpenPosition

import logging

logger = logging.getLogger(__name__)


class SessionManager:
    """Manages trading session state, metrics calculation, and circuit breakers."""

    def __init__(
        self,
        starting_balance_usd: float = 0.0,
        preferences: Optional[TradePreferences] = None,
    ):
        """Initialize a new trading session.
        
        Args:
            starting_balance_usd: USD balance to start with
            preferences: Trading preferences (limits, constraints)
        """
        self.session_id = str(uuid.uuid4())
        self.start_time = time.time()
        
        # Capital tracking
        self.starting_balance = starting_balance_usd
        self.current_balance = starting_balance_usd
        self.peak_balance = starting_balance_usd
        
        # PnL tracking
        self.cumulative_pnl = 0.0
        self.peak_pnl = 0.0
        self.trades: list[ExecutedTrade] = []
        self.open_positions: dict[str, OpenPosition] = {}
        
        # Preferences
        self.preferences = preferences or TradePreferences(
            max_trade_size_usd=200.0,
            max_open_positions=3,
            max_session_drawdown_pct=8.0,
            position_timeout_seconds=3600,
            preferred_protocols=[],
            exclude_protocols=[],
            min_confidence=0.5,
        )
        
        # Circuit breaker state
        self.circuit_breaker_active = False
        self.halt_reason: Optional[str] = None
        self.cycle_count = 0
        
    def add_executed_trade(self, trade: ExecutedTrade) -> None:
        """Record an executed trade and update session metrics."""
        self.trades.append(trade)
        
        # Update balance
        self.current_balance += trade["net_pnl"]
        self.cumulative_pnl += trade["net_pnl"]
        
        # Track peak
        if self.current_balance > self.peak_balance:
            self.peak_balance = self.current_balance
        if self.cumulative_pnl > self.peak_pnl:
            self.peak_pnl = self.cumulative_pnl
        
        logger.info(
            f"[SESSION] Trade recorded: {trade['pair']} "
            f"PnL={trade['net_pnl']:+.2f} → Session PnL={self.cumulative_pnl:+.2f}"
        )

        # Persist to database
        try:
            from db import get_db

            db = get_db()
            trade_record = dict(trade)
            trade_record["session_id"] = self.session_id
            db.insert_executed_trade(trade_record)
        except Exception as e:
            logger.warning(f"Failed to persist trade to database: {e}")
    
    def update_open_position(self, pair: str, position: Optional[OpenPosition]) -> None:
        """Update or remove an open position."""
        if position is None:
            self.open_positions.pop(pair, None)
        else:
            self.open_positions[pair] = position
    
    def get_current_drawdown_pct(self) -> float:
        """Calculate current drawdown from peak as percentage.
        
        Drawdown = (Peak - Current) / Peak * 100
        
        Returns:
            Drawdown percentage (0-100%). Returns 0 if peak is 0.
        """
        if self.peak_pnl <= 0:
            return 0.0
        
        drawdown = (self.peak_pnl - self.cumulative_pnl) / self.peak_pnl * 100
        return max(0.0, drawdown)  # Clamp to >= 0
    
    def check_circuit_breaker(self) -> bool:
        """Check if any circuit breaker should be triggered.
        
        Triggers halt if:
        1. Drawdown exceeds max_session_drawdown_pct (default 8%)
        2. Balance falls below 0
        3. Consecutive losses exceed threshold
        
        Returns:
            True if halt triggered, False otherwise.
        """
        # Check drawdown
        current_dd = self.get_current_drawdown_pct()
        max_dd = self.preferences.get("max_session_drawdown_pct", 8.0)
        
        if current_dd > max_dd:
            self.circuit_breaker_active = True
            self.halt_reason = (
                f"Drawdown {current_dd:.1f}% exceeds limit {max_dd}%"
            )
            logger.warning(f"[CIRCUIT BREAKER] {self.halt_reason}")
            return True
        
        # Check if balance went negative (should never happen in real trading)
        if self.current_balance < 0:
            self.circuit_breaker_active = True
            self.halt_reason = "Balance negative"
            logger.warning(f"[CIRCUIT BREAKER] {self.halt_reason}")
            return True
        
        # Check for watermark reset (shouldn't happen)
        if self.current_balance > self.peak_balance:
            self.peak_balance = self.current_balance
        
        return False
    
    def get_session_metrics(self) -> SessionMetrics:
        """Calculate and return full session metrics."""
        winning_trades = sum(1 for t in self.trades if t.get("net_pnl", 0) > 0)
        losing_trades = sum(1 for t in self.trades if t.get("net_pnl", 0) < 0)
        total_trades = len(self.trades)
        
        win_rate = (winning_trades / total_trades * 100) if total_trades > 0 else 0.0
        avg_trade_pnl = (self.cumulative_pnl / total_trades) if total_trades > 0 else 0.0
        
        # Average win/loss
        wins = [t.get("net_pnl", 0) for t in self.trades if t.get("net_pnl", 0) > 0]
        losses = [t.get("net_pnl", 0) for t in self.trades if t.get("net_pnl", 0) < 0]
        
        avg_win = (sum(wins) / len(wins)) if wins else 0.0
        avg_loss = (sum(losses) / len(losses)) if losses else 0.0
        
        # Best/worst trade
        best_trade = max((t.get("net_pnl", 0) for t in self.trades), default=0.0)
        worst_trade = min((t.get("net_pnl", 0) for t in self.trades), default=0.0)
        
        # Sharpe ratio (simplified)
        sharpe = self._calculate_sharpe()
        
        return SessionMetrics(
            session_id=self.session_id,
            start_time=self.start_time,
            end_time=None,
            starting_balance=self.starting_balance,
            current_balance=self.current_balance,
            peak_balance=self.peak_balance,
            cumulative_pnl=self.cumulative_pnl,
            peak_pnl=self.peak_pnl,
            max_drawdown_pct=self.get_current_drawdown_pct(),
            total_trades=total_trades,
            winning_trades=winning_trades,
            losing_trades=losing_trades,
            vetoed_trades=0,  # Populated by caller
            win_rate=win_rate,
            avg_trade_pnl=avg_trade_pnl,
            avg_win=avg_win,
            avg_loss=avg_loss,
            best_trade=best_trade,
            worst_trade=worst_trade,
            sharpe_ratio=sharpe,
            cycle_count=self.cycle_count,
            circuit_breaker_triggered=self.circuit_breaker_active,
        )
    
    def _calculate_sharpe(self, risk_free_rate: float = 0.04) -> Optional[float]:
        """Calculate simplified Sharpe ratio.
        
        Sharpe = (mean_return - risk_free_rate) / std_dev
        
        Returns None if insufficient data.
        """
        if len(self.trades) < 3:
            return None
        
        try:
            import statistics
            
            returns = [
                t.get("net_pnl", 0) / self.starting_balance
                for t in self.trades
                if self.starting_balance > 0
            ]
            
            if not returns or len(returns) < 2:
                return None
            
            mean_return = statistics.mean(returns)
            std_dev = statistics.stdev(returns)
            
            if std_dev == 0:
                return None
            
            daily_risk_free = risk_free_rate / 365
            sharpe = (mean_return - daily_risk_free) / std_dev
            
            return round(sharpe, 2)
        except Exception as e:
            logger.warning(f"Failed to calculate Sharpe: {e}")
            return None
    
    def increment_cycle(self) -> None:
        """Mark that one cycle has completed."""
        self.cycle_count += 1
    
    def is_halted(self) -> bool:
        """Check if session is currently halted."""
        return self.circuit_breaker_active
    
    def get_halt_reason(self) -> Optional[str]:
        """Get reason for halt if applicable."""
        return self.halt_reason

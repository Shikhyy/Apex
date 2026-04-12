"""APEX Data Models — SessionMetrics, ExecutedTrade, and related types."""

from typing import TypedDict, Optional, List
from datetime import datetime


class ExecutedTrade(TypedDict, total=False):
    """Record of a single executed trade with full P&L accounting."""
    trade_id: str                    # UUID
    timestamp: float                 # Unix timestamp
    cycle_number: int                # Which cycle this trade was from
    source: str                      # "kraken" | "surge"
    pair: str                        # "BTC/USD" | "pool_name"
    side: str                        # "buy" | "sell"
    amount_usd: float                # Position size in USD
    entry_price: float               # Fill price at entry
    exit_price: float                # Fill price at exit (if closed)
    
    # P&L components
    gross_pnl: float                 # Exit value - entry value (before fees)
    kraken_fee_usd: float            # Kraken exchange fee (0.16%-0.26%)
    gas_cost_usd: float              # Transaction gas in USD (on-chain only)
    fees_usd: float                  # Total fees (kraken + gas)
    net_pnl: float                   # Gross PnL - fees
    
    # References
    kraken_order_id: Optional[str]   # Kraken's order ID
    tx_hash: Optional[str]           # On-chain transaction hash (Surge)
    erc8004_evidence: Optional[str]  # IPFS URI of evidence payload
    
    # Metadata
    guardian_approved: bool          # Did Guardian approve this trade?
    is_open: bool                    # Still holding position?
    unrealized_pnl: Optional[float]  # Current P&L if open position


class SessionMetrics(TypedDict, total=False):
    """Aggregated session-level trading metrics."""
    session_id: str                  # Unique session identifier
    start_time: float                # Unix timestamp of session start
    end_time: Optional[float]        # Unix timestamp of session end (if ended)
    
    # Capital tracking
    starting_balance: float          # USD balance at session start
    current_balance: float           # USD balance now
    peak_balance: float              # Highest balance reached
    
    # PnL metrics
    cumulative_pnl: float            # Total P&L for session
    peak_pnl: float                  # Best peak P&L reached
    max_drawdown_pct: float          # Worst drawdown from peak (0-100%)
    
    # Trade statistics
    total_trades: int                # All executed trades
    winning_trades: int              # Trades with positive P&L
    losing_trades: int               # Trades with negative P&L
    vetoed_trades: int               # Trades rejected by Guardian
    
    # Rates
    win_rate: float                  # winning_trades / total_trades (0-100%)
    avg_trade_pnl: float             # cumulative_pnl / total_trades
    avg_win: float                   # Average P&L of winning trades
    avg_loss: float                  # Average P&L of losing trades
    
    # Risk metrics
    sharpe_ratio: Optional[float]    # Risk-adjusted return estimate
    best_trade: float                # Highest single trade profit
    worst_trade: float               # Largest single trade loss
    
    # Trading activity
    cycle_count: int                 # Number of full cycles executed
    circuit_breaker_triggered: bool  # Did safety halt trigger?


class OpenPosition(TypedDict, total=False):
    """Current open position in a trading pair."""
    pair: str
    entry_price: float               # Price when opened
    current_price: float             # Price now
    amount: float                    # Quantity held
    amount_usd: float                # USD value of position
    unrealized_pnl: float            # Current gain/loss
    pnl_percent: float               # Unrealized P&L as percentage
    timestamp: float                 # When position opened


class TradePreferences(TypedDict, total=False):
    """User trading preferences and constraints."""
    max_trade_size_usd: float = 200.0        # Max USD per single trade
    max_open_positions: int = 3              # Max simultaneous positions
    max_session_drawdown_pct: float = 8.0    # Halt if drawdown exceeds this
    position_timeout_seconds: int = 3600     # Auto-close position after this
    preferred_protocols: List[str]           # ["aave", "curve", ...]
    exclude_protocols: List[str]             # Blacklist certain protocols
    min_confidence: float = 0.5              # Min Guardian approval confidence


# In-memory session state tracker
class SessionState(TypedDict, total=False):
    """Runtime state tracking for current trading session."""
    session_id: str
    session_metrics: SessionMetrics
    trade_history: List[ExecutedTrade]
    open_positions: dict  # pair → OpenPosition
    preferences: TradePreferences
    circuit_breaker_active: bool
    halt_reason: Optional[str]
    last_trade_time: float
    last_cycle_time: float

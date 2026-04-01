"""SQLite persistence layer for APEX cycle history and reputation snapshots."""

import json
import logging
import os
import sqlite3
from datetime import datetime, timezone
from typing import Optional

logger = logging.getLogger(__name__)

DB_PATH = os.environ.get(
    "APEX_DB_PATH",
    os.path.join(os.path.dirname(os.path.abspath(__file__)), "apex.db"),
)


class Database:
    """SQLite-backed storage for cycle history and reputation snapshots."""

    def __init__(self, db_path: Optional[str] = None):
        self.db_path = db_path or DB_PATH
        self._init_db()

    def _get_conn(self) -> sqlite3.Connection:
        conn = sqlite3.connect(self.db_path)
        conn.row_factory = sqlite3.Row
        return conn

    def _init_db(self):
        conn = self._get_conn()
        conn.executescript("""
            CREATE TABLE IF NOT EXISTS cycles (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                timestamp TEXT NOT NULL,
                node TEXT NOT NULL,
                guardian_decision TEXT,
                guardian_reason TEXT,
                guardian_detail TEXT,
                tx_hash TEXT,
                executed_protocol TEXT,
                actual_pnl REAL,
                execution_error TEXT,
                session_pnl REAL,
                veto_count INTEGER,
                approval_count INTEGER,
                cycle_number INTEGER,
                market_state TEXT,
                intents TEXT,
                veto_reason TEXT
            );
            CREATE TABLE IF NOT EXISTS reputation_snapshots (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                agent_id INTEGER NOT NULL,
                timestamp TEXT NOT NULL,
                total_signals INTEGER,
                positive_signals INTEGER,
                negative_signals INTEGER,
                reputation_score REAL
            );
            CREATE INDEX IF NOT EXISTS idx_cycles_timestamp ON cycles(timestamp);
            CREATE INDEX IF NOT EXISTS idx_cycles_cycle_number ON cycles(cycle_number);
            CREATE INDEX IF NOT EXISTS idx_rep_agent ON reputation_snapshots(agent_id);
        """)
        conn.commit()
        conn.close()
        logger.info("Database initialized at %s", self.db_path)

    def insert_cycle_event(
        self, node: str, timestamp: str, data: dict, cycle_number: int = 0
    ):
        """Insert a single node event from a cycle."""
        conn = self._get_conn()
        conn.execute(
            """INSERT INTO cycles (
                timestamp, node, guardian_decision, guardian_reason,
                guardian_detail, tx_hash, executed_protocol, actual_pnl,
                execution_error, session_pnl, veto_count, approval_count,
                cycle_number, market_state, intents, veto_reason
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
            (
                timestamp,
                node,
                data.get("guardian_decision"),
                data.get("guardian_reason"),
                data.get("guardian_detail"),
                data.get("tx_hash"),
                data.get("executed_protocol"),
                data.get("actual_pnl"),
                data.get("execution_error"),
                data.get("session_pnl"),
                data.get("veto_count"),
                data.get("approval_count"),
                cycle_number,
                json.dumps(data.get("opportunities", [])),
                json.dumps(data.get("ranked_intents", [])),
                data.get("veto_reason"),
            ),
        )
        conn.commit()
        conn.close()

    def get_cycle_log(self, limit: int = 100) -> list[dict]:
        """Get recent cycle events, newest first."""
        conn = self._get_conn()
        rows = conn.execute(
            "SELECT * FROM cycles ORDER BY id DESC LIMIT ?", (limit,)
        ).fetchall()
        conn.close()
        result = []
        for row in rows:
            entry = dict(row)
            if entry.get("market_state"):
                try:
                    entry["market_state"] = json.loads(entry["market_state"])
                except json.JSONDecodeError:
                    pass
            if entry.get("intents"):
                try:
                    entry["intents"] = json.loads(entry["intents"])
                except json.JSONDecodeError:
                    pass
            result.append(entry)
        return result

    def insert_reputation_snapshot(
        self, agent_id: int, total: int, positive: int, negative: int, score: float
    ):
        """Record a reputation snapshot."""
        conn = self._get_conn()
        conn.execute(
            """INSERT INTO reputation_snapshots
               (agent_id, timestamp, total_signals, positive_signals,
                negative_signals, reputation_score)
               VALUES (?, ?, ?, ?, ?, ?)""",
            (
                agent_id,
                datetime.now(timezone.utc).isoformat(),
                total,
                positive,
                negative,
                score,
            ),
        )
        conn.commit()
        conn.close()

    def get_latest_reputation(self, agent_id: int) -> Optional[dict]:
        """Get the most recent reputation snapshot for an agent."""
        conn = self._get_conn()
        row = conn.execute(
            "SELECT * FROM reputation_snapshots WHERE agent_id = ? ORDER BY id DESC LIMIT 1",
            (agent_id,),
        ).fetchone()
        conn.close()
        return dict(row) if row else None


# Module-level singleton
_db: Optional[Database] = None


def get_db() -> Database:
    """Get or create the database singleton."""
    global _db
    if _db is None:
        _db = Database()
    return _db

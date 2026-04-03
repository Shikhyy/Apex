"""Supabase persistence layer for APEX cycle history and reputation snapshots.

Falls back to in-memory storage when Supabase credentials are not set,
so the backend works for local development and demos without a database.
"""

import json
import logging
import os
from datetime import datetime, timezone
from typing import Optional

from dotenv import load_dotenv

load_dotenv()

logger = logging.getLogger(__name__)

SUPABASE_URL = os.environ.get("SUPABASE_URL", "")
SUPABASE_KEY = os.environ.get("SUPABASE_KEY", "")


class Database:
    """Supabase-backed storage for cycle history and reputation snapshots.

    When Supabase credentials are not configured, falls back to in-memory
    lists so the backend works for local development and demos.
    """

    def __init__(self, url: Optional[str] = None, key: Optional[str] = None):
        self.url = url or SUPABASE_URL
        self.key = key or SUPABASE_KEY
        self._use_supabase = bool(self.url and self.key)
        self._memory_cycles: list[dict] = []
        self._memory_reputation: list[dict] = []

        if self._use_supabase:
            from supabase import Client, create_client

            self.client: Client = create_client(self.url, self.key)
            logger.info("Database initialized — Supabase: %s", self.url)
        else:
            logger.info(
                "Database initialized — in-memory fallback (no Supabase credentials)"
            )

    def insert_cycle_event(
        self, node: str, timestamp: str, data: dict, cycle_number: int = 0
    ):
        """Insert a single node event from a cycle."""
        payload = {
            "timestamp": timestamp,
            "node": node,
            "guardian_decision": data.get("guardian_decision"),
            "guardian_reason": data.get("guardian_reason"),
            "guardian_detail": data.get("guardian_detail"),
            "tx_hash": data.get("tx_hash"),
            "executed_protocol": data.get("executed_protocol"),
            "actual_pnl": data.get("actual_pnl"),
            "execution_error": data.get("execution_error"),
            "session_pnl": data.get("session_pnl"),
            "veto_count": data.get("veto_count"),
            "approval_count": data.get("approval_count"),
            "cycle_number": cycle_number,
            "market_state": data.get("opportunities", []),
            "intents": data.get("ranked_intents", []),
            "veto_reason": data.get("veto_reason"),
        }
        if self._use_supabase:
            try:
                self.client.table("cycles").insert(payload).execute()
            except Exception as e:
                logger.error("Failed to insert cycle event into Supabase: %s", e)
        self._memory_cycles.append(payload)

    def get_cycle_log(self, limit: int = 100) -> list[dict]:
        """Get recent cycle events, newest first."""
        if self._use_supabase:
            try:
                result = (
                    self.client.table("cycles")
                    .select("*")
                    .order("id", desc=True)
                    .limit(limit)
                    .execute()
                )
                if result.data:
                    return result.data
            except Exception as e:
                logger.error("Failed to fetch cycle log from Supabase: %s", e)
        return list(reversed(self._memory_cycles[-limit:]))

    def insert_reputation_snapshot(
        self, agent_id: int, total: int, positive: int, negative: int, score: float
    ):
        """Record a reputation snapshot."""
        payload = {
            "agent_id": agent_id,
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "total_signals": total,
            "positive_signals": positive,
            "negative_signals": negative,
            "reputation_score": score,
        }
        if self._use_supabase:
            try:
                self.client.table("reputation_snapshots").insert(payload).execute()
            except Exception as e:
                logger.error(
                    "Failed to insert reputation snapshot into Supabase: %s", e
                )
        self._memory_reputation.append(payload)

    def get_latest_reputation(self, agent_id: int) -> Optional[dict]:
        """Get the most recent reputation snapshot for an agent."""
        if self._use_supabase:
            try:
                result = (
                    self.client.table("reputation_snapshots")
                    .select("*")
                    .eq("agent_id", agent_id)
                    .order("id", desc=True)
                    .limit(1)
                    .execute()
                )
                if result.data:
                    return result.data[0]
            except Exception as e:
                logger.error(
                    "Failed to fetch reputation for agent_id=%d from Supabase: %s",
                    agent_id,
                    e,
                )
        for snap in reversed(self._memory_reputation):
            if snap.get("agent_id") == agent_id:
                return snap
        return None


# Module-level singleton
_db: Optional[Database] = None


def get_db() -> Database:
    """Get or create the database singleton."""
    global _db
    if _db is None:
        _db = Database()
    return _db

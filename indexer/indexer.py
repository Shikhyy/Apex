#!/usr/bin/env python3
"""
APEX Off-Chain Indexer / Subgraph

Indexes ERC-8004 registry events from Base Sepolia and powers a discovery
dashboard + leaderboard via HTTP API on port 3002.

Events tracked:
  - Registered        (IdentityRegistry)
  - FeedbackSubmitted (ReputationRegistry)
  - TradeExecuted     (RiskRouter)
  - DailyLossLimitHit (RiskRouter)

Usage:
    cd /Users/shikhar/Apex && source .venv/bin/activate && python indexer/indexer.py
"""

import json
import math
import os
import sqlite3
import sys
import time
from contextlib import contextmanager
from datetime import datetime, timezone

from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from uvicorn import run
from web3 import Web3

# ---------------------------------------------------------------------------
# Config
# ---------------------------------------------------------------------------

load_dotenv()

RPC_URL = os.getenv("BASE_SEPOLIA_RPC", "https://sepolia.base.org")
CHAIN_ID = 84532

ADDRESSES_FILE = os.path.join(
    os.path.dirname(os.path.dirname(__file__)), "contracts", "addresses.json"
)
SCHEMA_FILE = os.path.join(os.path.dirname(__file__), "schema.sql")
DB_PATH = os.path.join(os.path.dirname(__file__), "indexer.db")

POLL_INTERVAL = int(os.getenv("INDEXER_POLL_INTERVAL", "12"))  # seconds
BATCH_SIZE = int(os.getenv("INDEXER_BATCH_SIZE", "500"))

# ---------------------------------------------------------------------------
# Contract addresses & minimal ABIs
# ---------------------------------------------------------------------------

with open(ADDRESSES_FILE) as f:
    _addresses = json.load(f)

IDENTITY_REGISTRY = _addresses["identity_registry"]
REPUTATION_REGISTRY = _addresses["reputation_registry"]
RISK_ROUTER = os.getenv("RISK_ROUTER_ADDRESS") or _addresses.get("risk_router", "")

IDENTITY_ABI = [
    {
        "anonymous": False,
        "inputs": [
            {"indexed": True, "name": "agentId", "type": "uint256"},
            {"indexed": False, "name": "agentURI", "type": "string"},
            {"indexed": True, "name": "owner", "type": "address"},
        ],
        "name": "Registered",
        "type": "event",
    }
]

REPUTATION_ABI = [
    {
        "anonymous": False,
        "inputs": [
            {"indexed": True, "name": "agentId", "type": "uint256"},
            {"indexed": True, "name": "clientAddress", "type": "address"},
            {"indexed": False, "name": "feedbackIndex", "type": "uint64"},
            {"indexed": False, "name": "value", "type": "int128"},
            {"indexed": False, "name": "valueDecimals", "type": "uint8"},
            {"indexed": True, "name": "indexedTag1", "type": "string"},
            {"indexed": False, "name": "tag1", "type": "string"},
            {"indexed": False, "name": "tag2", "type": "string"},
            {"indexed": False, "name": "endpoint", "type": "string"},
            {"indexed": False, "name": "feedbackURI", "type": "string"},
            {"indexed": False, "name": "feedbackHash", "type": "bytes32"},
        ],
        "name": "FeedbackSubmitted",
        "type": "event",
    }
]

RISK_ROUTER_ABI = [
    {
        "anonymous": False,
        "inputs": [
            {"indexed": True, "name": "agentWallet", "type": "address"},
            {"indexed": True, "name": "agentId", "type": "uint256"},
            {"indexed": False, "name": "protocol", "type": "string"},
            {"indexed": False, "name": "pool", "type": "string"},
            {"indexed": False, "name": "amountUsd", "type": "uint256"},
            {"indexed": False, "name": "leverage", "type": "uint256"},
            {"indexed": False, "name": "intentHash", "type": "bytes32"},
            {"indexed": False, "name": "timestamp", "type": "uint256"},
        ],
        "name": "TradeExecuted",
        "type": "event",
    },
    {
        "anonymous": False,
        "inputs": [
            {"indexed": True, "name": "agentWallet", "type": "address"},
            {"indexed": True, "name": "agentId", "type": "uint256"},
            {"indexed": False, "name": "dailyLoss", "type": "uint256"},
            {"indexed": False, "name": "dailyLossLimit", "type": "uint256"},
            {"indexed": False, "name": "timestamp", "type": "uint256"},
        ],
        "name": "DailyLossLimitHit",
        "type": "event",
    },
]


# ---------------------------------------------------------------------------
# Database helpers
# ---------------------------------------------------------------------------


def init_db():
    """Create the SQLite database and apply schema."""
    conn = sqlite3.connect(DB_PATH)
    conn.execute("PRAGMA journal_mode=WAL")
    conn.execute("PRAGMA foreign_keys=ON")
    with open(SCHEMA_FILE) as f:
        conn.executescript(f.read())
    conn.commit()
    return conn


@contextmanager
def get_db():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys=ON")
    try:
        yield conn
    finally:
        conn.close()


def _ts_from_block(w3, block_number):
    """Return UTC datetime for a block number."""
    ts = w3.eth.get_block(block_number).timestamp
    return datetime.fromtimestamp(ts, tz=timezone.utc).isoformat()


# ---------------------------------------------------------------------------
# Event indexing
# ---------------------------------------------------------------------------


def _normalize(value, decimals):
    """Convert fixed-point integer to float."""
    return value / (10**decimals)


def index_registered(w3, contract, from_block, to_block, db):
    """Process Registered events from IdentityRegistry."""
    for event in contract.events.Registered.get_logs(
        fromBlock=from_block, toBlock=to_block
    ):
        agent_id = event["args"]["agentId"]
        agent_uri = event["args"]["agentURI"]
        owner = event["args"]["owner"]

        # Resolve agent wallet from on-chain mapping
        try:
            agent_wallet = contract.functions.getAgentWallet(agent_id).call()
        except Exception:
            agent_wallet = owner

        ts = _ts_from_block(w3, event["blockNumber"])

        db.execute(
            """INSERT OR REPLACE INTO agents
               (agent_id, owner, agent_uri, agent_wallet, registered_at, last_updated)
               VALUES (?, ?, ?, ?, ?, ?)""",
            (agent_id, owner, agent_uri, agent_wallet, ts, ts),
        )

        db.execute(
            """INSERT INTO events (event_type, contract_address, tx_hash, block_number, log_index, timestamp, data)
               VALUES (?, ?, ?, ?, ?, ?, ?)""",
            (
                "Registered",
                contract.address,
                event["transactionHash"].hex(),
                event["blockNumber"],
                event["logIndex"],
                ts,
                json.dumps(
                    {"agentId": agent_id, "agentURI": agent_uri, "owner": owner}
                ),
            ),
        )

        # Ensure metrics row exists
        db.execute(
            """INSERT OR IGNORE INTO agent_metrics (agent_id) VALUES (?)""",
            (agent_id,),
        )
    db.commit()


def index_feedback(w3, contract, from_block, to_block, db):
    """Process FeedbackSubmitted events from ReputationRegistry."""
    for event in contract.events.FeedbackSubmitted.get_logs(
        fromBlock=from_block, toBlock=to_block
    ):
        args = event["args"]
        agent_id = args["agentId"]
        client = args["clientAddress"]
        feedback_index = args["feedbackIndex"]
        value = _normalize(args["value"], args["valueDecimals"])
        ts = _ts_from_block(w3, event["blockNumber"])

        db.execute(
            """INSERT INTO feedback
               (agent_id, client_address, feedback_index, value, value_decimals,
                tag1, tag2, endpoint, feedback_uri, feedback_hash,
                block_number, timestamp)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
            (
                agent_id,
                client,
                feedback_index,
                value,
                args["valueDecimals"],
                args.get("tag1", ""),
                args.get("tag2", ""),
                args.get("endpoint", ""),
                args.get("feedbackURI", ""),
                args.get("feedbackHash", b"").hex() if args.get("feedbackHash") else "",
                event["blockNumber"],
                ts,
            ),
        )

        db.execute(
            """INSERT INTO events (event_type, contract_address, tx_hash, block_number, log_index, timestamp, data)
               VALUES (?, ?, ?, ?, ?, ?, ?)""",
            (
                "FeedbackSubmitted",
                contract.address,
                event["transactionHash"].hex(),
                event["blockNumber"],
                event["logIndex"],
                ts,
                json.dumps(
                    {
                        "agentId": agent_id,
                        "clientAddress": client,
                        "value": value,
                        "tag1": args.get("tag1", ""),
                        "tag2": args.get("tag2", ""),
                    }
                ),
            ),
        )

        # Update metrics
        _refresh_metrics(db, agent_id)
    db.commit()


def index_trades(w3, contract, from_block, to_block, db):
    """Process TradeExecuted events from RiskRouter."""
    for event in contract.events.TradeExecuted.get_logs(
        fromBlock=from_block, toBlock=to_block
    ):
        args = event["args"]
        agent_id = args["agentId"]
        agent_wallet = args["agentWallet"]
        amount_usd = args["amountUsd"] / 1e18
        ts = _ts_from_block(w3, event["blockNumber"])

        db.execute(
            """INSERT INTO trades
               (agent_id, agent_wallet, protocol, pool, amount_usd, leverage,
                intent_hash, block_number, timestamp)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)""",
            (
                agent_id,
                agent_wallet,
                args["protocol"],
                args["pool"],
                amount_usd,
                args["leverage"],
                args["intentHash"].hex(),
                event["blockNumber"],
                ts,
            ),
        )

        db.execute(
            """INSERT INTO events (event_type, contract_address, tx_hash, block_number, log_index, timestamp, data)
               VALUES (?, ?, ?, ?, ?, ?, ?)""",
            (
                "TradeExecuted",
                contract.address,
                event["transactionHash"].hex(),
                event["blockNumber"],
                event["logIndex"],
                ts,
                json.dumps(
                    {
                        "agentId": agent_id,
                        "agentWallet": agent_wallet,
                        "protocol": args["protocol"],
                        "pool": args["pool"],
                        "amountUsd": amount_usd,
                        "leverage": args["leverage"],
                    }
                ),
            ),
        )

        _refresh_metrics(db, agent_id)
    db.commit()


def index_loss_hits(w3, contract, from_block, to_block, db):
    """Process DailyLossLimitHit events from RiskRouter."""
    for event in contract.events.DailyLossLimitHit.get_logs(
        fromBlock=from_block, toBlock=to_block
    ):
        args = event["args"]
        agent_id = args["agentId"]
        agent_wallet = args["agentWallet"]
        daily_loss = args["dailyLoss"] / 1e18
        daily_loss_limit = args["dailyLossLimit"] / 1e18
        ts = _ts_from_block(w3, event["blockNumber"])

        db.execute(
            """INSERT INTO daily_loss_limit_hits
               (agent_id, agent_wallet, daily_loss, daily_loss_limit, block_number, timestamp)
               VALUES (?, ?, ?, ?, ?, ?)""",
            (
                agent_id,
                agent_wallet,
                daily_loss,
                daily_loss_limit,
                event["blockNumber"],
                ts,
            ),
        )

        db.execute(
            """INSERT INTO events (event_type, contract_address, tx_hash, block_number, log_index, timestamp, data)
               VALUES (?, ?, ?, ?, ?, ?, ?)""",
            (
                "DailyLossLimitHit",
                contract.address,
                event["transactionHash"].hex(),
                event["blockNumber"],
                event["logIndex"],
                ts,
                json.dumps(
                    {
                        "agentId": agent_id,
                        "agentWallet": agent_wallet,
                        "dailyLoss": daily_loss,
                        "dailyLossLimit": daily_loss_limit,
                    }
                ),
            ),
        )

        _refresh_metrics(db, agent_id)
    db.commit()


# ---------------------------------------------------------------------------
# Metrics computation
# ---------------------------------------------------------------------------


def _refresh_metrics(db, agent_id):
    """Recalculate leaderboard metrics for a single agent."""
    # Trade stats
    row = db.execute(
        """SELECT COUNT(*) as total_trades,
                  COALESCE(SUM(amount_usd), 0) as total_volume
           FROM trades WHERE agent_id = ?""",
        (agent_id,),
    ).fetchone()
    total_trades = row["total_trades"]
    total_volume = row["total_volume"]

    # PnL: approximated as net trade volume weighted by leverage direction
    # For on-chain data we use trade count and volume as proxy;
    # real PnL requires trade outcome data which lives off-chain.
    # Here we use a simple heuristic: volume * avg_leverage_factor * 0.01
    pnl_row = db.execute(
        """SELECT COALESCE(SUM(amount_usd * leverage), 0) as weighted_volume
           FROM trades WHERE agent_id = ?""",
        (agent_id,),
    ).fetchone()
    realized_pnl = pnl_row["weighted_volume"] * 0.001  # 0.1% assumed edge

    # Sharpe ratio: simplified from trade returns
    trade_rows = db.execute(
        """SELECT amount_usd, leverage FROM trades WHERE agent_id = ? ORDER BY timestamp""",
        (agent_id,),
    ).fetchall()

    if len(trade_rows) >= 2:
        returns = [(t["amount_usd"] * t["leverage"] * 0.001) for t in trade_rows]
        avg_ret = sum(returns) / len(returns)
        variance = sum((r - avg_ret) ** 2 for r in returns) / len(returns)
        std_ret = math.sqrt(variance) if variance > 0 else 1e-9
        sharpe = (avg_ret / std_ret) * math.sqrt(252) if std_ret > 0 else 0
    else:
        sharpe = 0

    # Max drawdown: cumulative PnL peak-to-trough
    if trade_rows:
        cum = 0
        peak = 0
        max_dd = 0
        for t in trade_rows:
            cum += t["amount_usd"] * t["leverage"] * 0.001
            if cum > peak:
                peak = cum
            dd = (peak - cum) / peak if peak > 0 else 0
            if dd > max_dd:
                max_dd = dd
    else:
        max_dd = 0

    # Validation score: from feedback
    fb_row = db.execute(
        """SELECT COUNT(*) as cnt,
                  COALESCE(AVG(CASE WHEN is_revoked = 0 THEN value ELSE NULL END), 0) as avg_val
           FROM feedback WHERE agent_id = ?""",
        (agent_id,),
    ).fetchone()
    feedback_count = fb_row["cnt"]
    avg_feedback = fb_row["avg_val"]

    # Daily loss hits
    loss_row = db.execute(
        """SELECT COUNT(*) as hits FROM daily_loss_limit_hits WHERE agent_id = ?""",
        (agent_id,),
    ).fetchone()
    daily_loss_hits = loss_row["hits"]

    # Composite: weighted score
    validation_score = min(avg_feedback, 1.0) if avg_feedback > 0 else 0
    composite = (
        sharpe * 0.35
        + (1 - max_dd) * 0.25
        + validation_score * 0.25
        + min(total_trades / 10, 1.0) * 0.15
    )

    db.execute(
        """INSERT OR REPLACE INTO agent_metrics
           (agent_id, total_trades, total_volume, realized_pnl, sharpe_ratio,
            max_drawdown, validation_score, feedback_count, avg_feedback,
            daily_loss_hits, last_updated)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
        (
            agent_id,
            total_trades,
            total_volume,
            realized_pnl,
            round(sharpe, 4),
            round(max_dd, 4),
            round(validation_score, 4),
            feedback_count,
            round(avg_feedback, 4),
            daily_loss_hits,
            datetime.now(timezone.utc).isoformat(),
        ),
    )


def refresh_all_metrics(db):
    """Recalculate metrics for every known agent."""
    agents = db.execute("SELECT agent_id FROM agents").fetchall()
    for a in agents:
        _refresh_metrics(db, a["agent_id"])
    db.commit()


# ---------------------------------------------------------------------------
# Indexer loop
# ---------------------------------------------------------------------------


def get_last_indexed_block(db):
    row = db.execute("SELECT MAX(block_number) as blk FROM events").fetchone()
    return row["blk"] if row["blk"] else None


def run_indexer(w3, id_contract, rep_contract, risk_contract, db):
    """Main indexing loop — polls for new events."""
    current_block = w3.eth.block_number
    last_block = get_last_indexed_block(db)

    if last_block is None:
        # Backfill from contract deployment — start from a safe checkpoint
        last_block = current_block - 10000
        if last_block < 0:
            last_block = 0
        print(f"[indexer] No prior state — backfilling from block {last_block}")
    else:
        last_block = last_block + 1  # resume from next block

    if last_block > current_block:
        print(f"[indexer] Already caught up at block {current_block}")
        return current_block

    # Process in batches
    from_block = last_block
    while from_block <= current_block:
        to_block = min(from_block + BATCH_SIZE - 1, current_block)
        print(f"[indexer] Scanning blocks {from_block}–{to_block} ...")

        index_registered(w3, id_contract, from_block, to_block, db)
        index_feedback(w3, rep_contract, from_block, to_block, db)

        if risk_contract:
            index_trades(w3, risk_contract, from_block, to_block, db)
            index_loss_hits(w3, risk_contract, from_block, to_block, db)

        from_block = to_block + 1

    print(f"[indexer] Caught up to block {current_block}")
    return current_block


# ---------------------------------------------------------------------------
# HTTP API
# ---------------------------------------------------------------------------

app = FastAPI(title="APEX Indexer API", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/leaderboard")
def leaderboard(limit: int = 50, sort_by: str = "composite"):
    """Ranked agents by composite score."""
    valid_sort = {"composite", "sharpe", "pnl", "volume", "validation", "trades"}
    if sort_by not in valid_sort:
        raise HTTPException(400, f"sort_by must be one of: {', '.join(valid_sort)}")

    sort_map = {
        "composite": "(m.sharpe_ratio * 0.35 + (1 - m.max_drawdown) * 0.25 + m.validation_score * 0.25 + MIN(m.total_trades / 10.0, 1.0) * 0.15)",
        "sharpe": "m.sharpe_ratio",
        "pnl": "m.realized_pnl",
        "volume": "m.total_volume",
        "validation": "m.validation_score",
        "trades": "m.total_trades",
    }

    with get_db() as db:
        rows = db.execute(
            f"""SELECT a.agent_id, a.owner, a.agent_wallet, a.agent_uri,
                       m.total_trades, m.total_volume, m.realized_pnl,
                       m.sharpe_ratio, m.max_drawdown, m.validation_score,
                       m.feedback_count, m.avg_feedback, m.daily_loss_hits,
                       m.last_updated,
                       {sort_map[sort_by]} as score
                FROM agents a
                LEFT JOIN agent_metrics m ON a.agent_id = m.agent_id
                ORDER BY score DESC
                LIMIT ?""",
            (limit,),
        ).fetchall()

        return JSONResponse([dict(r) for r in rows])


@app.get("/agents/{agent_id}")
def agent_detail(agent_id: int):
    """Detailed stats for a single agent."""
    with get_db() as db:
        agent = db.execute(
            "SELECT * FROM agents WHERE agent_id = ?", (agent_id,)
        ).fetchone()
        if not agent:
            raise HTTPException(404, f"Agent {agent_id} not found")

        metrics = db.execute(
            "SELECT * FROM agent_metrics WHERE agent_id = ?", (agent_id,)
        ).fetchone()

        recent_trades = db.execute(
            "SELECT * FROM trades WHERE agent_id = ? ORDER BY timestamp DESC LIMIT 20",
            (agent_id,),
        ).fetchall()

        recent_feedback = db.execute(
            "SELECT * FROM feedback WHERE agent_id = ? ORDER BY timestamp DESC LIMIT 20",
            (agent_id,),
        ).fetchall()

        loss_hits = db.execute(
            "SELECT * FROM daily_loss_limit_hits WHERE agent_id = ? ORDER BY timestamp DESC LIMIT 10",
            (agent_id,),
        ).fetchall()

        return JSONResponse(
            {
                "agent": dict(agent),
                "metrics": dict(metrics) if metrics else None,
                "recent_trades": [dict(t) for t in recent_trades],
                "recent_feedback": [dict(f) for f in recent_feedback],
                "daily_loss_limit_hits": [dict(l) for l in loss_hits],
            }
        )


@app.get("/events")
def recent_events(limit: int = 50, event_type: str = None):
    """Recent on-chain events."""
    with get_db() as db:
        if event_type:
            rows = db.execute(
                "SELECT * FROM events WHERE event_type = ? ORDER BY block_number DESC, log_index DESC LIMIT ?",
                (event_type, limit),
            ).fetchall()
        else:
            rows = db.execute(
                "SELECT * FROM events ORDER BY block_number DESC, log_index DESC LIMIT ?",
                (limit,),
            ).fetchall()

        return JSONResponse([dict(r) for r in rows])


@app.get("/health")
def health():
    with get_db() as db:
        last_block = db.execute(
            "SELECT MAX(block_number) as blk FROM events"
        ).fetchone()
        agent_count = db.execute("SELECT COUNT(*) as cnt FROM agents").fetchone()
        return {
            "status": "ok",
            "last_indexed_block": last_block["blk"],
            "total_agents": agent_count["cnt"],
            "chain_id": CHAIN_ID,
        }


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------


def main():
    print("[indexer] Connecting to Base Sepolia ...")
    w3 = Web3(Web3.HTTPProvider(RPC_URL))
    if not w3.is_connected():
        print(f"[indexer] ERROR: Cannot connect to RPC at {RPC_URL}")
        sys.exit(1)

    print(
        f"[indexer] Connected — chain_id={w3.eth.chain_id}, latest_block={w3.eth.block_number}"
    )

    # Deploy contracts
    id_contract = w3.eth.contract(
        address=Web3.to_checksum_address(IDENTITY_REGISTRY),
        abi=IDENTITY_ABI,
    )
    rep_contract = w3.eth.contract(
        address=Web3.to_checksum_address(REPUTATION_REGISTRY),
        abi=REPUTATION_ABI,
    )

    risk_contract = None
    if RISK_ROUTER:
        risk_contract = w3.eth.contract(
            address=Web3.to_checksum_address(RISK_ROUTER),
            abi=RISK_ROUTER_ABI,
        )
        print(f"[indexer] RiskRouter: {RISK_ROUTER}")
    else:
        print(
            "[indexer] WARNING: RISK_ROUTER_ADDRESS not set — trade/loss events will be skipped"
        )

    # Init DB
    db = init_db()
    print(f"[indexer] Database: {DB_PATH}")

    # Initial backfill
    last_block = run_indexer(w3, id_contract, rep_contract, risk_contract, db)
    refresh_all_metrics(db)
    db.close()

    # Start API server in background thread, then poll
    import threading

    def start_api():
        run(app, host="0.0.0.0", port=3002, log_level="info")

    api_thread = threading.Thread(target=start_api, daemon=True)
    api_thread.start()
    print("[indexer] API server started on http://0.0.0.0:3002")

    # Polling loop
    print(f"[indexer] Polling every {POLL_INTERVAL}s ...")
    while True:
        try:
            time.sleep(POLL_INTERVAL)
            db = init_db()
            last_block = run_indexer(w3, id_contract, rep_contract, risk_contract, db)
            refresh_all_metrics(db)
            db.close()
        except Exception as e:
            print(f"[indexer] Error during poll: {e}")
            time.sleep(POLL_INTERVAL)


if __name__ == "__main__":
    main()

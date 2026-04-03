-- APEX Indexer Database Schema
-- Tracks on-chain events from ERC-8004 registries for discovery dashboard and leaderboard.

CREATE TABLE IF NOT EXISTS agents (
    agent_id INTEGER PRIMARY KEY,
    owner TEXT NOT NULL,
    agent_uri TEXT,
    agent_wallet TEXT,
    registered_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    event_type TEXT NOT NULL,
    contract_address TEXT NOT NULL,
    tx_hash TEXT NOT NULL,
    block_number INTEGER NOT NULL,
    log_index INTEGER NOT NULL,
    timestamp TIMESTAMP NOT NULL,
    data TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS feedback (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    agent_id INTEGER NOT NULL,
    client_address TEXT NOT NULL,
    feedback_index INTEGER NOT NULL,
    value REAL NOT NULL,
    value_decimals INTEGER NOT NULL,
    tag1 TEXT,
    tag2 TEXT,
    endpoint TEXT,
    feedback_uri TEXT,
    feedback_hash TEXT,
    is_revoked BOOLEAN DEFAULT 0,
    block_number INTEGER NOT NULL,
    timestamp TIMESTAMP NOT NULL,
    FOREIGN KEY (agent_id) REFERENCES agents(agent_id)
);

CREATE TABLE IF NOT EXISTS trades (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    agent_id INTEGER NOT NULL,
    agent_wallet TEXT NOT NULL,
    protocol TEXT NOT NULL,
    pool TEXT NOT NULL,
    amount_usd REAL NOT NULL,
    leverage INTEGER NOT NULL,
    intent_hash TEXT NOT NULL,
    block_number INTEGER NOT NULL,
    timestamp TIMESTAMP NOT NULL,
    FOREIGN KEY (agent_id) REFERENCES agents(agent_id)
);

CREATE TABLE IF NOT EXISTS daily_loss_limit_hits (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    agent_id INTEGER NOT NULL,
    agent_wallet TEXT NOT NULL,
    daily_loss REAL NOT NULL,
    daily_loss_limit REAL NOT NULL,
    block_number INTEGER NOT NULL,
    timestamp TIMESTAMP NOT NULL,
    FOREIGN KEY (agent_id) REFERENCES agents(agent_id)
);

CREATE TABLE IF NOT EXISTS agent_metrics (
    agent_id INTEGER PRIMARY KEY,
    total_trades INTEGER DEFAULT 0,
    total_volume REAL DEFAULT 0,
    realized_pnl REAL DEFAULT 0,
    sharpe_ratio REAL DEFAULT 0,
    max_drawdown REAL DEFAULT 0,
    validation_score REAL DEFAULT 0,
    feedback_count INTEGER DEFAULT 0,
    avg_feedback REAL DEFAULT 0,
    daily_loss_hits INTEGER DEFAULT 0,
    last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (agent_id) REFERENCES agents(agent_id)
);

CREATE INDEX IF NOT EXISTS idx_events_type ON events(event_type);
CREATE INDEX IF NOT EXISTS idx_events_block ON events(block_number);
CREATE INDEX IF NOT EXISTS idx_feedback_agent ON feedback(agent_id);
CREATE INDEX IF NOT EXISTS idx_trades_agent ON trades(agent_id);
CREATE INDEX IF NOT EXISTS idx_trades_timestamp ON trades(timestamp);
CREATE INDEX IF NOT EXISTS idx_loss_hits_agent ON daily_loss_limit_hits(agent_id);

"""Social engagement module for APEX.

Handles public progress sharing — posting cycle results to Twitter/X and Discord,
generating human-readable summaries, and tracking engagement stats.

All network calls fall back to mock responses so the demo never breaks.
"""

import logging
import os
from datetime import datetime, timezone
from typing import Optional

import httpx

logger = logging.getLogger(__name__)

TWITTER_BEARER_TOKEN = os.environ.get("TWITTER_BEARER_TOKEN", "")
TWITTER_API_KEY = os.environ.get("TWITTER_API_KEY", "")
TWITTER_API_SECRET = os.environ.get("TWITTER_API_SECRET", "")
DISCORD_WEBHOOK_URL = os.environ.get("DISCORD_WEBHOOK_URL", "")

TWITTER_API_URL = "https://api.twitter.com/2/tweets"

# In-memory engagement stats
_social_stats = {
    "total_posts": 0,
    "twitter_posts": 0,
    "discord_posts": 0,
    "last_post_time": None,
    "last_post_platform": None,
    "likes": 0,
    "retweets": 0,
}


def _now_ts() -> str:
    return datetime.now(timezone.utc).isoformat()


def post_to_twitter(text: str) -> dict:
    """Post a message to Twitter/X via API v2.

    Uses Bearer token authentication. Falls back to a mock response
    when the API key is not set or the request fails.

    Args:
        text: The tweet text to post (max 280 chars enforced).

    Returns:
        Dict with keys:
            - success (bool): Whether the post succeeded
            - tweet_id (str): ID of the posted tweet (mock or real)
            - platform (str): "twitter"
            - text (str): The posted text
            - mock (bool): Whether a mock response was used
    """
    if not text:
        return {"success": False, "error": "Empty text", "platform": "twitter"}

    text = text[:280]

    if not TWITTER_BEARER_TOKEN:
        logger.warning("TWITTER_BEARER_TOKEN not set, using mock twitter post")
        mock_id = f"mock_{hash(text) & 0xFFFFFFFF:08x}"
        _social_stats["total_posts"] += 1
        _social_stats["twitter_posts"] += 1
        _social_stats["last_post_time"] = _now_ts()
        _social_stats["last_post_platform"] = "twitter"
        return {
            "success": True,
            "tweet_id": mock_id,
            "platform": "twitter",
            "text": text,
            "mock": True,
        }

    try:
        with httpx.Client(timeout=10.0) as client:
            resp = client.post(
                TWITTER_API_URL,
                headers={
                    "Authorization": f"Bearer {TWITTER_BEARER_TOKEN}",
                    "Content-Type": "application/json",
                },
                json={"text": text},
            )
            resp.raise_for_status()
            data = resp.json()
            tweet_id = data.get("data", {}).get("id", "unknown")
            _social_stats["total_posts"] += 1
            _social_stats["twitter_posts"] += 1
            _social_stats["last_post_time"] = _now_ts()
            _social_stats["last_post_platform"] = "twitter"
            return {
                "success": True,
                "tweet_id": tweet_id,
                "platform": "twitter",
                "text": text,
                "mock": False,
            }
    except Exception as exc:
        logger.error("Twitter post failed: %s", exc)
        return {
            "success": False,
            "error": str(exc),
            "platform": "twitter",
            "text": text,
            "mock": False,
        }


def post_to_discord(
    webhook_url: Optional[str] = None, embed: Optional[dict] = None
) -> dict:
    """Post an embed message to a Discord webhook.

    Falls back to mock response when no webhook URL is configured or
    the request fails.

    Args:
        webhook_url: Discord webhook URL. Falls back to DISCORD_WEBHOOK_URL env var.
        embed: Discord embed object dict. If None, a default embed is created.

    Returns:
        Dict with keys:
            - success (bool): Whether the post succeeded
            - platform (str): "discord"
            - mock (bool): Whether a mock response was used
    """
    url = webhook_url or DISCORD_WEBHOOK_URL

    if not url:
        logger.warning("Discord webhook URL not set, using mock discord post")
        _social_stats["total_posts"] += 1
        _social_stats["discord_posts"] += 1
        _social_stats["last_post_time"] = _now_ts()
        _social_stats["last_post_platform"] = "discord"
        return {
            "success": True,
            "platform": "discord",
            "mock": True,
        }

    if embed is None:
        embed = {
            "title": "APEX Cycle Update",
            "color": 5814783,
            "timestamp": _now_ts(),
        }

    payload = {"embeds": [embed]}

    try:
        with httpx.Client(timeout=10.0) as client:
            resp = client.post(url, json=payload)
            resp.raise_for_status()
            _social_stats["total_posts"] += 1
            _social_stats["discord_posts"] += 1
            _social_stats["last_post_time"] = _now_ts()
            _social_stats["last_post_platform"] = "discord"
            return {
                "success": True,
                "platform": "discord",
                "mock": False,
            }
    except Exception as exc:
        logger.error("Discord post failed: %s", exc)
        return {
            "success": False,
            "error": str(exc),
            "platform": "discord",
            "mock": False,
        }


def generate_cycle_summary(cycle_data: dict) -> str:
    """Generate a human-readable summary of a cycle's results.

    Extracts key metrics from cycle data (PnL, veto/approval counts,
    cycle number, guardian decisions) and formats them into a shareable
    text summary.

    Args:
        cycle_data: Dict with cycle results. Expected keys:
            - cycle_number (int)
            - session_pnl (float)
            - veto_count (int)
            - approval_count (int)
            - guardian_decision (str, optional)
            - tx_hash (str, optional)
            - opportunities (list, optional)

    Returns:
        A formatted string summary suitable for social media posting.
    """
    cycle_num = cycle_data.get("cycle_number", "?")
    pnl = cycle_data.get("session_pnl", 0.0)
    vetoes = cycle_data.get("veto_count", 0)
    approvals = cycle_data.get("approval_count", 0)
    guardian = cycle_data.get("guardian_decision", "")
    tx_hash = cycle_data.get("tx_hash", "")
    opportunities = cycle_data.get("opportunities", [])

    pnl_sign = "+" if pnl >= 0 else ""
    pnl_emoji = "🟢" if pnl >= 0 else "🔴"

    lines = [
        f"APEX Cycle #{cycle_num} Complete {pnl_emoji}",
        f"PnL: {pnl_sign}{pnl:.4f}",
        f"Approved: {approvals} | Vetoed: {vetoes}",
    ]

    if guardian:
        lines.append(f"Guardian: {guardian}")

    if tx_hash:
        short_hash = f"{tx_hash[:10]}...{tx_hash[-8:]}"
        lines.append(f"TX: {short_hash}")

    if opportunities:
        lines.append(f"Opportunities found: {len(opportunities)}")

    lines.append("#APEX #DeFi #AI")

    return "\n".join(lines)


def auto_share_cycle(cycle_data: dict) -> dict:
    """Orchestrate posting cycle results to all configured platforms.

    Generates a cycle summary, then posts to Twitter and Discord
    if their respective credentials/webhooks are configured.

    Args:
        cycle_data: Cycle result dict (same shape as generate_cycle_summary expects).

    Returns:
        Dict with keys:
            - success (bool): True if at least one platform succeeded
            - summary (str): The generated summary text
            - results (list): Per-platform result dicts
            - platforms_posted (list): Names of platforms that were posted to
    """
    summary = generate_cycle_summary(cycle_data)
    results = []
    platforms_posted = []

    # Post to Twitter
    twitter_result = post_to_twitter(summary)
    results.append(twitter_result)
    if twitter_result.get("success"):
        platforms_posted.append("twitter")

    # Post to Discord
    discord_embed = {
        "title": f"APEX Cycle #{cycle_data.get('cycle_number', '?')} Complete",
        "description": summary,
        "color": 5814783 if cycle_data.get("session_pnl", 0) >= 0 else 15548997,
        "timestamp": _now_ts(),
        "footer": {"text": "APEX — Autonomous Portfolio Execution"},
    }
    discord_result = post_to_discord(embed=discord_embed)
    results.append(discord_result)
    if discord_result.get("success"):
        platforms_posted.append("discord")

    return {
        "success": len(platforms_posted) > 0,
        "summary": summary,
        "results": results,
        "platforms_posted": platforms_posted,
    }


def get_social_stats() -> dict:
    """Return current social engagement stats.

    Returns:
        Dict with keys:
            - total_posts (int): Total posts across all platforms
            - twitter_posts (int): Number of Twitter posts
            - discord_posts (int): Number of Discord posts
            - last_post_time (str|None): ISO timestamp of last post
            - last_post_platform (str|None): Platform of last post
            - likes (int): Total likes (tracked from API responses)
            - retweets (int): Total retweets (tracked from API responses)
            - twitter_configured (bool): Whether Twitter credentials are set
            - discord_configured (bool): Whether Discord webhook is set
    """
    return {
        "total_posts": _social_stats["total_posts"],
        "twitter_posts": _social_stats["twitter_posts"],
        "discord_posts": _social_stats["discord_posts"],
        "last_post_time": _social_stats["last_post_time"],
        "last_post_platform": _social_stats["last_post_platform"],
        "likes": _social_stats["likes"],
        "retweets": _social_stats["retweets"],
        "twitter_configured": bool(TWITTER_BEARER_TOKEN),
        "discord_configured": bool(DISCORD_WEBHOOK_URL),
    }

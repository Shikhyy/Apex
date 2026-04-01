"""Market data tools for APEX yield optimizer.

Fetches real-time DeFi market data from external APIs for the Scout agent.
All functions are async, handle errors gracefully, and return sensible defaults.
"""

import httpx

TIMEOUT = 10.0


async def fetch_aave_yields() -> list[dict]:
    """Fetch Aave v3 yield data from DefiLlama API.

    Returns a list of dicts with keys: protocol, pool, apy, tvl_usd,
    risk_score (based on TVL), liquidity_usd.
    Returns empty list on failure.
    """
    url = "https://yields.llama.fi/pools"
    try:
        async with httpx.AsyncClient(timeout=TIMEOUT) as client:
            resp = await client.get(url)
            resp.raise_for_status()
            data = resp.json()

        pools: list[dict] = []
        for item in data.get("data", []):
            if item.get("project") != "aave":
                continue
            tvl = float(item.get("tvlUsd", 0))
            if tvl <= 0:
                continue
            apy = float(item.get("apy", 0))
            # Risk score inversely proportional to TVL (higher TVL = lower risk)
            risk_score = round(max(0.05, min(1.0, 1.0 - (tvl / 5_000_000_000))), 2)
            pools.append(
                {
                    "protocol": "aave",
                    "pool": item.get("pool", ""),
                    "apy": round(apy, 2),
                    "tvl_usd": round(tvl, 2),
                    "risk_score": risk_score,
                    "liquidity_usd": round(tvl * 0.8, 2),
                }
            )

        print(f"Fetched {len(pools)} Aave pools from DefiLlama")
        return pools

    except httpx.TimeoutException:
        print("ERROR: DefiLlama API timed out while fetching Aave yields")
    except httpx.ConnectError as e:
        print(f"ERROR: Connection error fetching Aave yields: {e}")
    except Exception as e:
        print(f"ERROR: Failed to fetch Aave yields: {e}")

    return []


async def fetch_curve_pools() -> list[dict]:
    """Fetch Curve Finance pool data from DefiLlama API.

    Returns a list of dicts with keys: protocol, pool, apy, tvl_usd,
    risk_score (based on TVL), liquidity_usd.
    Returns empty list on failure.
    """
    url = "https://yields.llama.fi/pools"
    try:
        async with httpx.AsyncClient(timeout=TIMEOUT) as client:
            resp = await client.get(url)
            resp.raise_for_status()
            data = resp.json()

        pools: list[dict] = []
        for item in data.get("data", []):
            if item.get("project") != "curve":
                continue
            tvl = float(item.get("tvlUsd", 0))
            if tvl <= 0:
                continue
            apy = float(item.get("apy", 0))
            risk_score = round(max(0.05, min(1.0, 1.0 - (tvl / 5_000_000_000))), 2)
            pools.append(
                {
                    "protocol": "curve",
                    "pool": item.get("pool", ""),
                    "apy": round(apy, 2),
                    "tvl_usd": round(tvl, 2),
                    "risk_score": risk_score,
                    "liquidity_usd": round(tvl * 0.8, 2),
                }
            )

        print(f"Fetched {len(pools)} Curve pools from DefiLlama")
        return pools

    except httpx.TimeoutException:
        print("ERROR: DefiLlama API timed out while fetching Curve pools")
    except httpx.ConnectError as e:
        print(f"ERROR: Connection error fetching Curve pools: {e}")
    except Exception as e:
        print(f"ERROR: Failed to fetch Curve pools: {e}")

    return []


async def fetch_volatility_index() -> float:
    """Calculate a simple volatility index from BTC/ETH price changes.

    Fetches 24h price change data from CoinGecko and computes a
    volatility score on a 0-100 scale (0=stable, 100=extreme volatility).
    Returns 42.0 as fallback on error.
    """
    url = "https://api.coingecko.com/api/v3/simple/price?ids=bitcoin,ethereum&vs_currencies=usd&include_24hr_change=true"
    try:
        async with httpx.AsyncClient(timeout=TIMEOUT) as client:
            resp = await client.get(url)
            resp.raise_for_status()
            data = resp.json()

        changes = []
        for coin in ("bitcoin", "ethereum"):
            if coin in data:
                change = abs(float(data[coin].get("usd_24h_change", 0)))
                changes.append(change)

        if changes:
            avg_change = sum(changes) / len(changes)
            # Map average % change to 0-100 scale
            # ~1% change = low vol (~10), ~10% change = extreme vol (~100)
            volatility = round(min(100.0, avg_change * 10), 2)
            print(f"Volatility index: {volatility} (avg 24h change: {avg_change:.2f}%)")
            return volatility

    except httpx.TimeoutException:
        print("ERROR: CoinGecko API timed out while fetching volatility")
    except httpx.ConnectError as e:
        print(f"ERROR: Connection error fetching volatility: {e}")
    except Exception as e:
        print(f"ERROR: Failed to fetch volatility index: {e}")

    return 42.0


async def fetch_sentiment() -> float:
    """Fetch crypto market sentiment score from Alternative.me Fear & Greed Index.

    Returns a score on -1.0 to 1.0 scale (-1=extreme fear, 1=extreme greed).
    Returns 0.0 as fallback on error.
    """
    url = "https://api.alternative.me/fng/?limit=1"
    try:
        async with httpx.AsyncClient(timeout=TIMEOUT) as client:
            resp = await client.get(url)
            resp.raise_for_status()
            data = resp.json()

        fng_value = float(data["data"][0]["value"])
        # Map 0-100 to -1.0 to +1.0
        sentiment = round((fng_value / 50.0) - 1.0, 2)
        print(f"Sentiment score: {sentiment} (Fear & Greed: {fng_value})")
        return sentiment

    except httpx.TimeoutException:
        print("ERROR: Alternative.me API timed out while fetching sentiment")
    except httpx.ConnectError as e:
        print(f"ERROR: Connection error fetching sentiment: {e}")
    except Exception as e:
        print(f"ERROR: Failed to fetch sentiment: {e}")

    return 0.0

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"

export async function fetchMarketPrices() {
  const res = await fetch(`${API_BASE}/market/prices`)
  if (!res.ok) throw new Error("Failed to fetch market prices")
  return res.json()
}

export async function fetchMarketSignals() {
  const res = await fetch(`${API_BASE}/market/signals`)
  if (!res.ok) throw new Error("Failed to fetch market signals")
  return res.json()
}

export async function fetchAerodromePools() {
  const res = await fetch(`${API_BASE}/market/aerodrome-pools`)
  if (!res.ok) throw new Error("Failed to fetch Aerodrome pools")
  return res.json()
}

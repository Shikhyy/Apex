const API_BASE = "http://localhost:8000"

export async function fetchHealth() {
  const res = await fetch(`${API_BASE}/health`)
  if (!res.ok) throw new Error("Health check failed")
  return res.json()
}

export async function fetchAgents() {
  const res = await fetch(`${API_BASE}/agents`)
  if (!res.ok) throw new Error("Failed to fetch agents")
  return res.json()
}

export async function fetchReputation(agentId: number) {
  const res = await fetch(`${API_BASE}/reputation/${agentId}`)
  if (!res.ok) throw new Error(`Failed to fetch reputation for agent ${agentId}`)
  return res.json()
}

export async function fetchLog() {
  const res = await fetch(`${API_BASE}/log`)
  if (!res.ok) throw new Error("Failed to fetch log")
  return res.json()
}

export async function triggerCycle() {
  const res = await fetch(`${API_BASE}/cycle`, { method: "POST" })
  if (!res.ok) throw new Error("Failed to trigger cycle")
  return res.json()
}

"use client";

import { useState, useEffect } from "react";
import { useAccount, useWriteContract } from "wagmi";
import Topbar from "@/components/dashboard/Topbar";
import Card from "@/components/ui/Card";
import { ADDRESSES, RISK_ROUTER_ABI } from "@/lib/contracts";
import { parseUnits } from "viem";

interface Settings {
  maxVolatility: number;
  maxDrawdown: number;
  minReputation: number;
  apyCap: number;
  apiKeys: { groq: string; kraken: string; pinata: string; surge: string };
  models: { scout: string; strategist: string; guardian: string; executor: string };
  cycleInterval: number;
  autoRun: boolean;
  maxRetries: number;
  network: "base-sepolia" | "base-mainnet";
}

const defaultSettings: Settings = {
  maxVolatility: 50,
  maxDrawdown: 20,
  minReputation: 70,
  apyCap: 100,
  apiKeys: { groq: "", kraken: "", pinata: "", surge: "" },
  models: { scout: "llama-3.1-70b", strategist: "llama-3.1-70b", guardian: "llama-3.1-70b", executor: "on-chain" },
  cycleInterval: 300,
  autoRun: false,
  maxRetries: 3,
  network: "base-sepolia",
};

export default function SettingsPage() {
  const { isConnected } = useAccount();
  const { writeContractAsync, isPending } = useWriteContract();
  const [settings, setSettings] = useState<Settings>(defaultSettings);
  const [saved, setSaved] = useState(false);
  const [showKeys, setShowKeys] = useState<Record<string, boolean>>({});
  const [status, setStatus] = useState<{ kind: "idle" | "success" | "error"; message: string }>({ kind: "idle", message: "" });
  const [ownerForm, setOwnerForm] = useState({
    agentWallet: "",
    dailyLossLimit: "1000",
    vaultBalance: "1000000",
    protocol: "AAVE",
    authorized: true,
  });

  useEffect(() => {
    const stored = localStorage.getItem("apex-settings");
    if (stored) {
      try {
        setSettings(JSON.parse(stored));
      } catch {
        // Use defaults
      }
    }
  }, []);

  const handleSave = () => {
    localStorage.setItem("apex-settings", JSON.stringify(settings));
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  };

  const handleReset = () => {
    localStorage.removeItem("apex-settings");
    setSettings(defaultSettings);
  };

  const update = <K extends keyof Settings>(key: K, value: Settings[K]) => {
    setSettings((prev) => ({ ...prev, [key]: value }));
  };

  const updateApiKey = (key: keyof Settings["apiKeys"], value: string) => {
    setSettings((prev) => ({ ...prev, apiKeys: { ...prev.apiKeys, [key]: value } }));
  };

  const updateModel = (agent: keyof Settings["models"], value: string) => {
    setSettings((prev) => ({ ...prev, models: { ...prev.models, [agent]: value } }));
  };

  const toggleKeyVisibility = (key: string) => {
    setShowKeys((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const riskRouterConfigured = Boolean(ADDRESSES.riskRouter);

  const submitOwnerAction = async (label: string, action: () => Promise<`0x${string}`>) => {
    if (!isConnected) {
      setStatus({ kind: "error", message: "Connect a wallet to use on-chain controls." });
      return;
    }

    if (!riskRouterConfigured) {
      setStatus({ kind: "error", message: "Set NEXT_PUBLIC_RISK_ROUTER_ADDRESS to enable on-chain controls." });
      return;
    }

    try {
      setStatus({ kind: "idle", message: "" });
      const hash = await action();
      setStatus({ kind: "success", message: `${label} submitted. Tx ${hash.slice(0, 10)}…` });
    } catch (error) {
      setStatus({
        kind: "error",
        message: error instanceof Error ? error.message : `${label} failed.`,
      });
    }
  };

  return (
    <>
      <Topbar title="Settings" connected={isConnected} />
      <main style={{ padding: 32, maxWidth: 800 }}>
        {/* Save Banner */}
        {saved && (
          <div
            style={{
              padding: "12px 20px",
              background: "#34d39915",
              border: "1px solid var(--green)",
              marginBottom: 24,
              fontFamily: "var(--font-mono)",
              fontSize: 11,
              color: "var(--green)",
              animation: "fadeIn 400ms var(--ease-out)",
            }}
          >
            ✓ Configuration saved to localStorage
          </div>
        )}

        {status.kind !== "idle" && (
          <div
            style={{
              padding: "12px 20px",
              background: status.kind === "success" ? "#34d39915" : "#ef444415",
              border: `1px solid ${status.kind === "success" ? "var(--green)" : "var(--red)"}`,
              marginBottom: 24,
              fontFamily: "var(--font-mono)",
              fontSize: 11,
              color: status.kind === "success" ? "var(--green)" : "var(--red)",
              animation: "fadeIn 400ms var(--ease-out)",
            }}
          >
            {status.message}
          </div>
        )}

        {/* Guardian Thresholds */}
        <Card title="Guardian Thresholds">
          {[
            { label: "Max Volatility", key: "maxVolatility" as const, min: 0, max: 100, unit: "%" },
            { label: "Max Drawdown", key: "maxDrawdown" as const, min: 0, max: 50, unit: "%" },
            { label: "Min Reputation", key: "minReputation" as const, min: 0, max: 100, unit: "" },
            { label: "APY Cap", key: "apyCap" as const, min: 0, max: 200, unit: "%" },
          ].map((s) => (
            <div key={s.key} style={{ marginBottom: 20 }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
                <label style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--muted)" }}>{s.label}</label>
                <span style={{ fontFamily: "var(--font-mono)", fontSize: 13, color: "var(--apex-burn)" }}>
                  {settings[s.key]}{s.unit}
                </span>
              </div>
              <input
                type="range"
                min={s.min}
                max={s.max}
                value={settings[s.key] as number}
                onChange={(e) => update(s.key, Number(e.target.value) as never)}
                style={{ width: "100%", accentColor: "var(--apex-burn)" }}
              />
            </div>
          ))}
        </Card>

        {/* API Keys */}
        <Card title="API Keys">
          {(Object.keys(settings.apiKeys) as Array<keyof Settings["apiKeys"]>).map((key) => (
            <div key={key} style={{ marginBottom: 16 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                <label style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--muted)", textTransform: "capitalize" }}>
                  {key}
                </label>
                <button
                  onClick={() => toggleKeyVisibility(key)}
                  style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--muted)" }}
                >
                  {showKeys[key] ? "Hide" : "Show"}
                </button>
              </div>
              <input
                type={showKeys[key] ? "text" : "password"}
                value={settings.apiKeys[key]}
                onChange={(e) => updateApiKey(key, e.target.value)}
                placeholder={`Enter ${key} API key`}
                style={{
                  width: "100%",
                  padding: "10px 12px",
                  background: "var(--raised)",
                  border: "1px solid var(--dim)",
                  fontFamily: "var(--font-mono)",
                  fontSize: 12,
                  color: "var(--white)",
                  outline: "none",
                }}
                onFocus={(e) => (e.currentTarget.style.borderColor = "var(--apex-burn)")}
                onBlur={(e) => (e.currentTarget.style.borderColor = "var(--dim)")}
              />
            </div>
          ))}
        </Card>

        {/* Agent Models */}
        <Card title="Agent Models">
          {(Object.keys(settings.models) as Array<keyof Settings["models"]>).map((agent) => (
            <div key={agent} style={{ marginBottom: 16 }}>
              <label style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--muted)", textTransform: "capitalize", display: "block", marginBottom: 8 }}>
                {agent}
              </label>
              <select
                value={settings.models[agent]}
                onChange={(e) => updateModel(agent, e.target.value)}
                style={{
                  width: "100%",
                  padding: "10px 12px",
                  background: "var(--raised)",
                  border: "1px solid var(--dim)",
                  fontFamily: "var(--font-mono)",
                  fontSize: 12,
                  color: "var(--white)",
                  outline: "none",
                }}
              >
                <option value="llama-3.1-70b">Llama 3.1 70B</option>
                <option value="llama-3.1-8b">Llama 3.1 8B</option>
                <option value="mixtral-8x7b">Mixtral 8x7B</option>
                <option value="gemma-7b">Gemma 7B</option>
                <option value="on-chain">On-chain (no LLM)</option>
              </select>
            </div>
          ))}
        </Card>

        {/* Cycle Settings */}
        <Card title="Cycle Settings">
          <div style={{ marginBottom: 20 }}>
            <label style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--muted)", display: "block", marginBottom: 8 }}>
              Cycle Interval (seconds)
            </label>
            <input
              type="number"
              value={settings.cycleInterval}
              onChange={(e) => update("cycleInterval", Number(e.target.value))}
              min={60}
              max={3600}
              style={{
                width: "100%",
                padding: "10px 12px",
                background: "var(--raised)",
                border: "1px solid var(--dim)",
                fontFamily: "var(--font-mono)",
                fontSize: 12,
                color: "var(--white)",
                outline: "none",
              }}
            />
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
            <input
              type="checkbox"
              checked={settings.autoRun}
              onChange={(e) => update("autoRun", e.target.checked)}
              style={{ accentColor: "var(--apex-burn)" }}
            />
            <label style={{ fontFamily: "var(--font-mono)", fontSize: 12, color: "var(--white)" }}>Auto-run cycles</label>
          </div>

          <div>
            <label style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--muted)", display: "block", marginBottom: 8 }}>
              Max Retries
            </label>
            <input
              type="number"
              value={settings.maxRetries}
              onChange={(e) => update("maxRetries", Number(e.target.value))}
              min={0}
              max={10}
              style={{
                width: "100%",
                padding: "10px 12px",
                background: "var(--raised)",
                border: "1px solid var(--dim)",
                fontFamily: "var(--font-mono)",
                fontSize: 12,
                color: "var(--white)",
                outline: "none",
              }}
            />
          </div>
        </Card>

        {/* Network */}
        <Card title="Network">
          <select
            value={settings.network}
            onChange={(e) => update("network", e.target.value as Settings["network"])}
            style={{
              width: "100%",
              padding: "10px 12px",
              background: "var(--raised)",
              border: "1px solid var(--dim)",
              fontFamily: "var(--font-mono)",
              fontSize: 12,
              color: "var(--white)",
              outline: "none",
              marginBottom: 16,
            }}
          >
            <option value="base-sepolia">Base Sepolia (Testnet)</option>
            <option value="base-mainnet">Base Mainnet</option>
          </select>
        </Card>

        {/* Contract Addresses */}
        <Card title="Contract Addresses">
          {[
            { label: "Identity Registry", value: ADDRESSES.identityRegistry },
            { label: "Reputation Registry", value: ADDRESSES.reputationRegistry },
            { label: "Risk Router", value: ADDRESSES.riskRouter || "Not configured" },
          ].map((c) => (
            <div key={c.label} style={{ marginBottom: 12 }}>
              <div style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--mid)", marginBottom: 4 }}>{c.label}</div>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  padding: "8px 12px",
                  background: "var(--raised)",
                  border: "1px solid var(--dim)",
                }}
              >
                <code style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--apex-burn)" }}>{c.value}</code>
                <button
                  onClick={() => navigator.clipboard.writeText(c.value)}
                  style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--muted)" }}
                >
                  Copy
                </button>
              </div>
            </div>
          ))}
        </Card>

        {/* On-Chain Controls (Owner Only) */}
        {isConnected && (
          <Card title="On-Chain Controls">
            <div style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--mid)", marginBottom: 16 }}>
              RiskRouter owner functions — requires contract owner privileges
            </div>
            {!riskRouterConfigured && (
              <div style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--red)", marginBottom: 16 }}>
                Configure NEXT_PUBLIC_RISK_ROUTER_ADDRESS to enable writes.
              </div>
            )}

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 16 }}>
              <div>
                <label style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--muted)", display: "block", marginBottom: 8 }}>
                  Agent Wallet
                </label>
                <input
                  value={ownerForm.agentWallet}
                  onChange={(e) => setOwnerForm((prev) => ({ ...prev, agentWallet: e.target.value }))}
                  placeholder="0x..."
                  style={{
                    width: "100%",
                    padding: "10px 12px",
                    background: "var(--raised)",
                    border: "1px solid var(--dim)",
                    fontFamily: "var(--font-mono)",
                    fontSize: 12,
                    color: "var(--white)",
                    outline: "none",
                  }}
                />
              </div>
              <div>
                <label style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--muted)", display: "block", marginBottom: 8 }}>
                  Daily Loss Limit (USD)
                </label>
                <input
                  value={ownerForm.dailyLossLimit}
                  onChange={(e) => setOwnerForm((prev) => ({ ...prev, dailyLossLimit: e.target.value }))}
                  inputMode="decimal"
                  style={{
                    width: "100%",
                    padding: "10px 12px",
                    background: "var(--raised)",
                    border: "1px solid var(--dim)",
                    fontFamily: "var(--font-mono)",
                    fontSize: 12,
                    color: "var(--white)",
                    outline: "none",
                  }}
                />
              </div>
              <div>
                <label style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--muted)", display: "block", marginBottom: 8 }}>
                  Vault Balance (USD)
                </label>
                <input
                  value={ownerForm.vaultBalance}
                  onChange={(e) => setOwnerForm((prev) => ({ ...prev, vaultBalance: e.target.value }))}
                  inputMode="decimal"
                  style={{
                    width: "100%",
                    padding: "10px 12px",
                    background: "var(--raised)",
                    border: "1px solid var(--dim)",
                    fontFamily: "var(--font-mono)",
                    fontSize: 12,
                    color: "var(--white)",
                    outline: "none",
                  }}
                />
              </div>
              <div>
                <label style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--muted)", display: "block", marginBottom: 8 }}>
                  Protocol
                </label>
                <input
                  value={ownerForm.protocol}
                  onChange={(e) => setOwnerForm((prev) => ({ ...prev, protocol: e.target.value }))}
                  placeholder="AAVE"
                  style={{
                    width: "100%",
                    padding: "10px 12px",
                    background: "var(--raised)",
                    border: "1px solid var(--dim)",
                    fontFamily: "var(--font-mono)",
                    fontSize: 12,
                    color: "var(--white)",
                    outline: "none",
                  }}
                />
              </div>
            </div>

            <div style={{ marginBottom: 16 }}>
              <label style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--muted)", display: "block", marginBottom: 8 }}>
                Authorization Mode
              </label>
              <select
                value={ownerForm.authorized ? "authorize" : "deauthorize"}
                onChange={(e) => setOwnerForm((prev) => ({ ...prev, authorized: e.target.value === "authorize" }))}
                style={{
                  width: "100%",
                  padding: "10px 12px",
                  background: "var(--raised)",
                  border: "1px solid var(--dim)",
                  fontFamily: "var(--font-mono)",
                  fontSize: 12,
                  color: "var(--white)",
                  outline: "none",
                }}
              >
                <option value="authorize">Authorize agent wallet</option>
                <option value="deauthorize">Revoke agent wallet</option>
              </select>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <button
                data-interactive
                onClick={() =>
                  submitOwnerAction("Vault balance update", () =>
                    writeContractAsync({
                      address: ADDRESSES.riskRouter,
                      abi: RISK_ROUTER_ABI,
                      functionName: "setVaultBalance",
                      args: [parseUnits(ownerForm.vaultBalance || "0", 18)],
                    })
                  )
                }
                disabled={!riskRouterConfigured || isPending}
                style={{
                  padding: "12px",
                  border: "1px solid var(--dim)",
                  fontFamily: "var(--font-mono)",
                  fontSize: 10,
                  letterSpacing: 1,
                  color: riskRouterConfigured ? "var(--white)" : "var(--muted)",
                  cursor: riskRouterConfigured ? "pointer" : "not-allowed",
                  opacity: isPending ? 0.6 : 1,
                }}
                title={riskRouterConfigured ? "Write vault balance" : "RiskRouter not configured"}
              >
                Set Vault Balance
              </button>
              <button
                data-interactive
                onClick={() =>
                  submitOwnerAction("Daily loss limit update", () =>
                    writeContractAsync({
                      address: ADDRESSES.riskRouter,
                      abi: RISK_ROUTER_ABI,
                      functionName: "setDailyLossLimit",
                      args: [ownerForm.agentWallet as `0x${string}`, parseUnits(ownerForm.dailyLossLimit || "0", 18)],
                    })
                  )
                }
                disabled={!riskRouterConfigured || isPending}
                style={{
                  padding: "12px",
                  border: "1px solid var(--dim)",
                  fontFamily: "var(--font-mono)",
                  fontSize: 10,
                  letterSpacing: 1,
                  color: riskRouterConfigured ? "var(--white)" : "var(--muted)",
                  cursor: riskRouterConfigured ? "pointer" : "not-allowed",
                  opacity: isPending ? 0.6 : 1,
                }}
                title={riskRouterConfigured ? "Write daily loss limit" : "RiskRouter not configured"}
              >
                Set Daily Loss Limit
              </button>
              <button
                data-interactive
                onClick={() =>
                  submitOwnerAction(ownerForm.authorized ? "Agent authorized" : "Agent deauthorized", () =>
                    writeContractAsync({
                      address: ADDRESSES.riskRouter,
                      abi: RISK_ROUTER_ABI,
                      functionName: "setAgentAuthorized",
                      args: [ownerForm.agentWallet as `0x${string}`, ownerForm.authorized],
                    })
                  )
                }
                disabled={!riskRouterConfigured || isPending}
                style={{
                  padding: "12px",
                  border: "1px solid var(--dim)",
                  fontFamily: "var(--font-mono)",
                  fontSize: 10,
                  letterSpacing: 1,
                  color: riskRouterConfigured ? "var(--white)" : "var(--muted)",
                  cursor: riskRouterConfigured ? "pointer" : "not-allowed",
                  opacity: isPending ? 0.6 : 1,
                }}
                title={riskRouterConfigured ? "Toggle agent authorization" : "RiskRouter not configured"}
              >
                {ownerForm.authorized ? "Authorize Agent" : "Deauthorize Agent"}
              </button>
              <button
                data-interactive
                onClick={() =>
                  submitOwnerAction("Protocol whitelist update", () =>
                    writeContractAsync({
                      address: ADDRESSES.riskRouter,
                      abi: RISK_ROUTER_ABI,
                      functionName: "setProtocolWhitelisted",
                      args: [ownerForm.protocol, true],
                    })
                  )
                }
                disabled={!riskRouterConfigured || isPending}
                style={{
                  padding: "12px",
                  border: "1px solid var(--dim)",
                  fontFamily: "var(--font-mono)",
                  fontSize: 10,
                  letterSpacing: 1,
                  color: riskRouterConfigured ? "var(--white)" : "var(--muted)",
                  cursor: riskRouterConfigured ? "pointer" : "not-allowed",
                  opacity: isPending ? 0.6 : 1,
                }}
                title={riskRouterConfigured ? "Whitelist protocol" : "RiskRouter not configured"}
              >
                Whitelist Protocol
              </button>
            </div>
            <div style={{ marginTop: 12, fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--mid)" }}>
              {riskRouterConfigured
                ? "Writes are sent through the connected wallet. The contract owner still must sign each transaction."
                : "RiskRouter address is missing from the frontend environment."}
            </div>
          </Card>
        )}

        {/* Actions */}
        <div style={{ display: "flex", gap: 16, marginTop: 32 }}>
          <button
            onClick={handleSave}
            data-interactive
            style={{
              padding: "14px 40px",
              background: "var(--apex-burn)",
              color: "var(--void)",
              fontFamily: "var(--font-mono)",
              fontSize: 11,
              letterSpacing: 2,
              textTransform: "uppercase",
              fontWeight: 700,
              transition: "all var(--fast) var(--ease-out)",
            }}
            onMouseEnter={(e) => (e.currentTarget.style.boxShadow = "0 4px 20px #e8ff0033")}
            onMouseLeave={(e) => (e.currentTarget.style.boxShadow = "none")}
          >
            Save Configuration
          </button>
          <button
            onClick={handleReset}
            style={{
              padding: "14px 40px",
              border: "1px solid var(--dim)",
              fontFamily: "var(--font-mono)",
              fontSize: 11,
              letterSpacing: 2,
              textTransform: "uppercase",
              color: "var(--muted)",
            }}
          >
            Reset to Defaults
          </button>
        </div>
      </main>
    </>
  );
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ background: "var(--deep)", border: "1px solid var(--dim)", padding: 24, marginBottom: 24 }}>
      <h3 style={{ fontFamily: "var(--font-mono)", fontSize: 11, letterSpacing: 2, color: "var(--apex-burn)", textTransform: "uppercase", marginBottom: 20 }}>
        {title}
      </h3>
      {children}
    </div>
  );
}

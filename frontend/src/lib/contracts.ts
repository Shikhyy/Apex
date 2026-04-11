import { type Address } from "viem";
import { publicClient } from "./viem";

export const ADDRESSES = {
  identityRegistry: process.env.NEXT_PUBLIC_IDENTITY_REGISTRY as Address,
  reputationRegistry: process.env.NEXT_PUBLIC_REPUTATION_REGISTRY as Address,
  riskRouter: (process.env.NEXT_PUBLIC_RISK_ROUTER_ADDRESS || process.env.NEXT_PUBLIC_SURGE_RISK_ROUTER_ADDRESS || "") as Address,
};

export const IDENTITY_REGISTRY_ABI = [
  {
    name: "getAgentWallet",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "agentId", type: "uint256" }],
    outputs: [{ name: "", type: "address" }],
  },
  {
    name: "getMetadata",
    type: "function",
    stateMutability: "view",
    inputs: [
      { name: "agentId", type: "uint256" },
      { name: "metadataKey", type: "string" },
    ],
    outputs: [{ name: "", type: "bytes" }],
  },
  {
    name: "totalAgents",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    name: "tokenURI",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "tokenId", type: "uint256" }],
    outputs: [{ name: "", type: "string" }],
  },
  {
    name: "ownerOf",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "tokenId", type: "uint256" }],
    outputs: [{ name: "", type: "address" }],
  },
] as const;

export const REPUTATION_REGISTRY_ABI = [
  {
    name: "giveFeedback",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "agentId", type: "uint256" },
      { name: "value", type: "int128" },
      { name: "valueDecimals", type: "uint8" },
      { name: "tag1", type: "string" },
      { name: "tag2", type: "string" },
      { name: "endpoint", type: "string" },
      { name: "feedbackURI", type: "string" },
      { name: "feedbackHash", type: "bytes32" },
    ],
    outputs: [{ name: "feedbackIndex", type: "uint64" }],
  },
  {
    name: "getSummary",
    type: "function",
    stateMutability: "view",
    inputs: [
      { name: "agentId", type: "uint256" },
      { name: "clientAddresses", type: "address[]" },
      { name: "tag1", type: "string" },
      { name: "tag2", type: "string" },
    ],
    outputs: [
      { name: "count", type: "uint64" },
      { name: "summaryValue", type: "int128" },
      { name: "summaryValueDecimals", type: "uint8" },
    ],
  },
  {
    name: "readFeedback",
    type: "function",
    stateMutability: "view",
    inputs: [
      { name: "agentId", type: "uint256" },
      { name: "clientAddress", type: "address" },
      { name: "feedbackIndex", type: "uint64" },
    ],
    outputs: [
      { name: "value", type: "int128" },
      { name: "valueDecimals", type: "uint8" },
      { name: "tag1", type: "string" },
      { name: "tag2", type: "string" },
      { name: "isRevoked", type: "bool" },
    ],
  },
  {
    name: "getClients",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "agentId", type: "uint256" }],
    outputs: [{ name: "", type: "address[]" }],
  },
  {
    name: "feedbackCount",
    type: "function",
    stateMutability: "view",
    inputs: [
      { name: "", type: "uint256" },
      { name: "", type: "address" },
    ],
    outputs: [{ name: "", type: "uint64" }],
  },
] as const;

export const RISK_ROUTER_ABI = [
  {
    name: "submitTradeIntent",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "agentId", type: "uint256" },
      { name: "protocol", type: "string" },
      { name: "pool", type: "string" },
      { name: "amountUsd", type: "uint256" },
      { name: "deadline", type: "uint256" },
      { name: "nonce", type: "uint256" },
      { name: "leverage", type: "uint256" },
      { name: "signature", type: "bytes" },
    ],
    outputs: [],
  },
  {
    name: "setVaultBalance",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [{ name: "newBalance", type: "uint256" }],
    outputs: [],
  },
  {
    name: "setDailyLossLimit",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "agentWallet", type: "address" },
      { name: "limit", type: "uint256" },
    ],
    outputs: [],
  },
  {
    name: "setAgentAuthorized",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "agentWallet", type: "address" },
      { name: "authorized", type: "bool" },
    ],
    outputs: [],
  },
  {
    name: "setProtocolWhitelisted",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "protocol", type: "string" },
      { name: "whitelisted", type: "bool" },
    ],
    outputs: [],
  },
] as const;

export async function getAgentWallet(agentId: bigint): Promise<Address> {
  return publicClient.readContract({
    address: ADDRESSES.identityRegistry,
    abi: IDENTITY_REGISTRY_ABI,
    functionName: "getAgentWallet",
    args: [agentId],
  }) as Promise<Address>;
}

export async function getAgentMetadata(agentId: bigint, key: string): Promise<`0x${string}`> {
  return publicClient.readContract({
    address: ADDRESSES.identityRegistry,
    abi: IDENTITY_REGISTRY_ABI,
    functionName: "getMetadata",
    args: [agentId, key],
  }) as Promise<`0x${string}`>;
}

export async function getTotalAgents(): Promise<bigint> {
  return publicClient.readContract({
    address: ADDRESSES.identityRegistry,
    abi: IDENTITY_REGISTRY_ABI,
    functionName: "totalAgents",
  }) as Promise<bigint>;
}

export async function getTokenURI(tokenId: bigint): Promise<string> {
  return publicClient.readContract({
    address: ADDRESSES.identityRegistry,
    abi: IDENTITY_REGISTRY_ABI,
    functionName: "tokenURI",
    args: [tokenId],
  }) as Promise<string>;
}

export async function getReputationSummary(
  agentId: bigint
): Promise<{ count: number; value: number; decimals: number; normalized: number }> {
  const clients = (await publicClient.readContract({
    address: ADDRESSES.reputationRegistry,
    abi: REPUTATION_REGISTRY_ABI,
    functionName: "getClients",
    args: [agentId],
  })) as Address[];

  const result = (await publicClient.readContract({
    address: ADDRESSES.reputationRegistry,
    abi: REPUTATION_REGISTRY_ABI,
    functionName: "getSummary",
    args: [agentId, clients, "", ""],
  })) as [bigint, bigint, number];

  const count = Number(result[0]);
  const value = Number(result[1]);
  const decimals = result[2];
  const normalized = decimals > 0 ? Math.min(100, Math.max(0, (value / 10 ** decimals) * 50 + 50)) : 50;

  return { count, value, decimals, normalized: Math.round(normalized) };
}

export async function getClients(agentId: bigint): Promise<Address[]> {
  return publicClient.readContract({
    address: ADDRESSES.reputationRegistry,
    abi: REPUTATION_REGISTRY_ABI,
    functionName: "getClients",
    args: [agentId],
  }) as Promise<Address[]>;
}

export async function readFeedback(
  agentId: bigint,
  clientAddress: Address,
  feedbackIndex: bigint
): Promise<[bigint, number, string, string, boolean]> {
  return publicClient.readContract({
    address: ADDRESSES.reputationRegistry,
    abi: REPUTATION_REGISTRY_ABI,
    functionName: "readFeedback",
    args: [agentId, clientAddress, feedbackIndex],
  }) as Promise<[bigint, number, string, string, boolean]>;
}

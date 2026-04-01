"""Strategist agent — trade intent generation."""

from langchain_groq import ChatGroq
from agents.graph import APEXState, TradeIntent, YieldOpportunity
from dotenv import load_dotenv
import os
import hashlib
import json

load_dotenv()

llm = ChatGroq(
    model="llama-3.3-70b-versatile",
    temperature=0.1,
    api_key=os.environ.get("GROQ_API_KEY", ""),
    max_retries=3,
)

STRATEGIST_SYSTEM = """You are the STRATEGIST agent in the APEX yield optimizer.
Rank opportunities by risk-adjusted return and generate signed trade intents.

Rules:
- Maximum single position: 20% of vault balance
- Scale down position by (volatility_index / 100)
- Never enter position if expected_pnl < $0 after estimated gas cost
- Confidence < 0.5 → exclude from ranked list
"""

VAULT_SIZE_USD = 1_000_000
MAX_POSITION_PCT = 0.20
MIN_CONFIDENCE = 0.5


def _generate_eip712_signature(intent_data: dict) -> str:
    """Generate an EIP-712 style signature. Uses eth_account if available, else mock."""
    try:
        from eth_account import Account
        from eth_account.messages import encode_typed_data

        domain = {
            "name": "APEX",
            "version": "1",
            "chainId": 1,
        }
        types = {
            "TradeIntent": [
                {"name": "protocol", "type": "string"},
                {"name": "pool", "type": "string"},
                {"name": "amountUsd", "type": "uint256"},
                {"name": "expectedPnl", "type": "uint256"},
            ],
        }
        message = {
            "protocol": intent_data["opportunity"]["protocol"],
            "pool": intent_data["opportunity"]["pool"],
            "amountUsd": int(intent_data["amount_usd"] * 1e6),
            "expectedPnl": int(intent_data["expected_pnl"] * 1e6),
        }
        account = Account.create()
        signable = encode_typed_data(
            domain_data=domain, message_types=types, message=message
        )
        signed = account.sign_message(signable)
        return signed.signature.hex()
    except Exception:
        payload = json.dumps(intent_data, sort_keys=True).encode()
        return "0x" + hashlib.sha512(payload).hexdigest()[:130]


def _compute_intent_hash(intent_data: dict) -> str:
    """SHA-256 hash of the intent data."""
    payload = json.dumps(intent_data, sort_keys=True).encode()
    return hashlib.sha256(payload).hexdigest()


def _calculate_confidence(risk_score: float) -> float:
    """Map risk_score (0-100) to confidence (0-1). Lower risk = higher confidence."""
    return max(0.0, min(1.0, 1.0 - (risk_score / 100.0)))


def _calculate_position_size(
    tvl_usd: float, risk_score: float, volatility_index: float
) -> float:
    """Calculate position size based on TVL, risk, and volatility."""
    base = min(tvl_usd * 0.10, VAULT_SIZE_USD * MAX_POSITION_PCT)
    risk_factor = 1.0 - (risk_score / 100.0)
    vol_factor = volatility_index / 100.0 if volatility_index > 0 else 1.0
    return base * risk_factor * vol_factor


def _rank_with_llm(
    opportunities: list[YieldOpportunity], volatility_index: float
) -> dict[str, float]:
    """Use LLM to rank opportunities and return scored results."""
    opp_text = json.dumps(opportunities, indent=2)
    prompt = f"""Given these yield opportunities and a volatility index of {volatility_index},
rank them by risk-adjusted return. For each opportunity, provide:
- protocol
- pool
- rank (1-based)
- risk_adjusted_score (0-100)

Opportunities:
{opp_text}

Return ONLY a JSON array of objects with keys: protocol, pool, rank, risk_adjusted_score."""

    try:
        response = llm.invoke(
            [
                ("system", STRATEGIST_SYSTEM),
                ("human", prompt),
            ]
        )
        content = response.content.strip()
        if content.startswith("```"):
            content = content.split("\n", 1)[-1].rsplit("```", 1)[0].strip()
        scores = json.loads(content)
        return {
            f"{s['protocol']}:{s['pool']}": s.get("risk_adjusted_score", 50)
            for s in scores
        }
    except Exception:
        return {}


def strategist_node(state: APEXState) -> dict:
    """Strategist node — ranks opportunities and generates trade intents."""
    try:
        opportunities = state.get("opportunities", [])
        volatility_index = state.get("volatility_index", 50.0)

        if not opportunities:
            return {
                "ranked_intents": [],
                "strategist_reasoning": "No opportunities provided by scout. Nothing to rank.",
            }

        llm_scores = _rank_with_llm(opportunities, volatility_index)

        intents: list[TradeIntent] = []
        reasoning_parts: list[str] = []

        for opp in opportunities:
            risk_score = opp.get("risk_score", 50.0)
            confidence = _calculate_confidence(risk_score)

            if confidence < MIN_CONFIDENCE:
                reasoning_parts.append(
                    f"Excluded {opp['protocol']}:{opp['pool']} — confidence {confidence:.2f} below threshold {MIN_CONFIDENCE}"
                )
                continue

            amount_usd = _calculate_position_size(
                opp.get("tvl_usd", 0), risk_score, volatility_index
            )
            apy = opp.get("apy", 0.0)
            expected_pnl = amount_usd * (apy / 100.0) * 0.25

            if expected_pnl <= 0:
                reasoning_parts.append(
                    f"Excluded {opp['protocol']}:{opp['pool']} — non-positive expected PNL (${expected_pnl:.2f})"
                )
                continue

            llm_bonus = llm_scores.get(f"{opp['protocol']}:{opp['pool']}", 50) / 100.0
            adjusted_confidence = (confidence * 0.7) + (llm_bonus * 0.3)
            adjusted_confidence = max(0.0, min(1.0, adjusted_confidence))

            if adjusted_confidence < MIN_CONFIDENCE:
                reasoning_parts.append(
                    f"Excluded {opp['protocol']}:{opp['pool']} — LLM-adjusted confidence {adjusted_confidence:.2f} below threshold"
                )
                continue

            intent_data = {
                "opportunity": opp,
                "amount_usd": round(amount_usd, 2),
                "expected_pnl": round(expected_pnl, 2),
                "confidence": round(adjusted_confidence, 4),
            }

            intent: TradeIntent = {
                "opportunity": opp,
                "amount_usd": round(amount_usd, 2),
                "expected_pnl": round(expected_pnl, 2),
                "confidence": round(adjusted_confidence, 4),
                "eip712_signature": _generate_eip712_signature(intent_data),
                "intent_hash": _compute_intent_hash(intent_data),
            }
            intents.append(intent)
            reasoning_parts.append(
                f"Included {opp['protocol']}:{opp['pool']} — "
                f"amount=${amount_usd:.2f}, pnl=${expected_pnl:.2f}, "
                f"confidence={adjusted_confidence:.2f}, risk={risk_score}"
            )

        intents.sort(key=lambda x: x["confidence"], reverse=True)

        total_exposure = sum(i["amount_usd"] for i in intents)
        reasoning = (
            f"Processed {len(opportunities)} opportunities, generated {len(intents)} intents. "
            f"Total exposure: ${total_exposure:.2f}. "
            f"Volatility index: {volatility_index}. " + " | ".join(reasoning_parts)
        )

        return {
            "ranked_intents": intents,
            "strategist_reasoning": reasoning,
        }

    except Exception as e:
        return {
            "ranked_intents": [],
            "strategist_reasoning": f"Strategist node error: {str(e)}",
        }

"""
CAOS-Mark Forensics Module
==========================
Gemini 1.5 Pro integration for contextual copyright analysis.

The module builds a structured prompt that forces the model to return a
strict JSON payload — no markdown fences, no prose.  The response is
validated and normalised before being returned to the caller.
"""

from __future__ import annotations

import json
import os
from typing import Any

import google.generativeai as genai

# ─────────────────────────────────────────────────────────────────────────────
# Types
# ─────────────────────────────────────────────────────────────────────────────

ForensicsResult = dict[str, Any]
"""
Expected shape::

    {
        "verdict":            "Fair Use" | "Suspicious" | "Malicious Piracy",
        "risk_score":         int  (1–10),
        "reasoning":          str,
        "recommended_action": "Monitor" | "DMCA Notice" | "Legal Action",
        "confidence":         float (0.0–1.0)
    }
"""

_REQUIRED_KEYS = {
    "verdict",
    "risk_score",
    "reasoning",
    "recommended_action",
    "confidence",
}

_VALID_VERDICTS = {"Fair Use", "Suspicious", "Malicious Piracy"}
_VALID_ACTIONS  = {"Monitor", "DMCA Notice", "Legal Action"}


# ─────────────────────────────────────────────────────────────────────────────
# Prompt builder
# ─────────────────────────────────────────────────────────────────────────────

def _build_prompt(
    extracted_signature: str,
    suspect_url: str,
    account_name: str,
) -> str:
    return f"""You are CAOS-Mark Forensics AI, an expert Digital Rights Management analyst embedded in a content-protection pipeline.

Your task is to evaluate whether a detected redistribution of a watermarked digital asset constitutes "Fair Use" or "Malicious Piracy."

────────────────────────────────────────
CASE FILE
────────────────────────────────────────
• Extracted watermark signature : {extracted_signature!r}
• URL where suspect content was found : {suspect_url}
• Account / entity name              : {account_name}

────────────────────────────────────────
EVALUATION CRITERIA
────────────────────────────────────────
Analyse the four pillars of fair-use doctrine:

1. PURPOSE & CHARACTER
   Is the use transformative (commentary, parody, journalism, education)?
   Or is it a direct commercial copy substituting for the original?

2. NATURE OF THE WORK
   Is the original factual / informational, or highly creative / commercial
   (e.g. professional sports photography, branded media)?

3. AMOUNT USED
   Does the redistribution use the whole asset, or only a small representative portion?

4. MARKET IMPACT
   Does this redistribution harm the rights-holder's ability to license or sell the work?

────────────────────────────────────────
VERDICT DEFINITIONS
────────────────────────────────────────
• "Fair Use"         → Transformative, non-commercial, minimal market harm.  risk_score 1–4.
• "Suspicious"       → Ambiguous intent; warrants closer monitoring.          risk_score 5–6.
• "Malicious Piracy" → Commercial exploitation, full reproduction, mass       risk_score 7–10.
                       redistribution, or deliberate watermark removal attempt.

────────────────────────────────────────
REQUIRED OUTPUT — STRICT JSON ONLY
────────────────────────────────────────
Respond with EXACTLY one JSON object.  No markdown code fences.  No prose before or after.

{{
  "verdict":            "<Fair Use|Suspicious|Malicious Piracy>",
  "risk_score":         <integer 1-10>,
  "reasoning":          "<2-3 sentence explanation referencing the four criteria above>",
  "recommended_action": "<Monitor|DMCA Notice|Legal Action>",
  "confidence":         <float 0.0-1.0>
}}"""


# ─────────────────────────────────────────────────────────────────────────────
# Response validator / normaliser
# ─────────────────────────────────────────────────────────────────────────────

def _strip_fences(raw: str) -> str:
    """Remove markdown code fences that some model versions add."""
    raw = raw.strip()
    if raw.startswith("```"):
        lines = raw.splitlines()
        raw = "\n".join(lines[1:-1] if lines[-1] == "```" else lines[1:])
    return raw.strip()


def _validate(data: dict) -> ForensicsResult:
    missing = _REQUIRED_KEYS - data.keys()
    if missing:
        raise ValueError(f"Gemini response missing keys: {missing}")

    # Normalise types and clamp ranges
    data["risk_score"]  = max(1, min(10, int(data["risk_score"])))
    data["confidence"]  = max(0.0, min(1.0, float(data["confidence"])))

    if data["verdict"] not in _VALID_VERDICTS:
        data["verdict"] = "Suspicious"          # safe fallback

    if data["recommended_action"] not in _VALID_ACTIONS:
        # Derive from risk_score if Gemini returned a non-standard string
        rs = data["risk_score"]
        data["recommended_action"] = (
            "Legal Action" if rs >= 8 else
            "DMCA Notice"  if rs >= 5 else
            "Monitor"
        )

    return data


# ─────────────────────────────────────────────────────────────────────────────
# Public API
# ─────────────────────────────────────────────────────────────────────────────

def analyze(
    extracted_signature: str,
    suspect_url: str,
    account_name: str,
    *,
    api_key: str | None = None,
    model_name: str = "gemini-1.5-pro",
) -> ForensicsResult:
    """
    Run Gemini 1.5 Pro forensics on a detected redistribution event.

    Parameters
    ----------
    extracted_signature : str
        The watermark signature extracted from the suspect image.
    suspect_url : str
        URL at which the suspect content was discovered.
    account_name : str
        Username / entity associated with the suspect content.
    api_key : str | None
        Overrides the ``GOOGLE_API_KEY`` env var when provided.
    model_name : str
        Generative model to use.  Defaults to ``gemini-1.5-pro``.

    Returns
    -------
    ForensicsResult
        Validated forensics payload (see module docstring for shape).

    Raises
    ------
    ValueError
        If the API key is missing or the model response is malformed.
    """
    key = api_key or os.getenv("GOOGLE_API_KEY")
    if not key:
        raise ValueError(
            "GOOGLE_API_KEY is not set.  "
            "Export it as an environment variable or pass it explicitly."
        )

    genai.configure(api_key=key)
    model = genai.GenerativeModel(model_name)

    response = model.generate_content(
        _build_prompt(extracted_signature, suspect_url, account_name),
        generation_config=genai.types.GenerationConfig(
            temperature=0.15,   # low temperature for consistent structured output
            top_p=0.9,
            max_output_tokens=512,
        ),
    )

    raw = _strip_fences(response.text)
    try:
        data = json.loads(raw)
    except json.JSONDecodeError as exc:
        raise ValueError(
            f"Gemini returned non-JSON output: {raw[:200]!r}"
        ) from exc

    return _validate(data)

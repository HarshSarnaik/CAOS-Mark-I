"""
CAOS-Mark — FastAPI Application
================================
Endpoints
---------
POST /protect  — Embed watermark; upload original + watermarked copy to GCS.
POST /verify   — Extract signature; run Gemini forensics; log event.
GET  /events   — Return paginated verification events from Firestore.
GET  /health   — Liveness probe for Cloud Run.
"""

from __future__ import annotations

import os
import uuid
from datetime import datetime, timezone

from dotenv import load_dotenv

# Load .env BEFORE importing local modules so that module-level constants
# like LOCAL_FALLBACK in storage.py are evaluated with the correct values.
load_dotenv()

from fastapi import FastAPI, File, Form, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, Response

import caos_core
import forensics
import storage

# ─────────────────────────────────────────────────────────────────────────────
# App setup
# ─────────────────────────────────────────────────────────────────────────────

app = FastAPI(
    title="CAOS-Mark API",
    description=(
        "Digital Asset Protection System — "
        "Arnold's Cat Map + DCT watermarking with Gemini AI forensics."
    ),
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],   # open for demo — tighten before production
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Runtime config (overridable via .env)
_ITERATIONS: int   = int(os.getenv("CAOS_ITERATIONS", "8"))
_STRENGTH:   float = float(os.getenv("CAOS_STRENGTH", "15.0"))
_MAX_BYTES:  int   = 20 * 1024 * 1024   # 20 MB


# ─────────────────────────────────────────────────────────────────────────────
# Utility
# ─────────────────────────────────────────────────────────────────────────────

def _assert_image(file: UploadFile) -> None:
    if not (file.content_type or "").startswith("image/"):
        raise HTTPException(
            status_code=415, detail="Uploaded file must be an image (JPEG / PNG)."
        )


# ─────────────────────────────────────────────────────────────────────────────
# Routes
# ─────────────────────────────────────────────────────────────────────────────

@app.get("/", tags=["meta"])
def root():
    return {
        "service": "CAOS-Mark",
        "status": "operational",
        "version": "1.0.0",
        "docs": "/docs",
    }


@app.get("/health", tags=["meta"])
def health():
    return {"status": "ok", "timestamp": datetime.now(timezone.utc).isoformat()}


# ── /protect ──────────────────────────────────────────────────────────────────

@app.post("/protect", tags=["core"])
async def protect(
    file: UploadFile = File(..., description="Image to watermark (JPEG / PNG)."),
    label: str = Form(
        ...,
        min_length=1,
        max_length=128,
        description="Human-readable signature (e.g. 'GSC-2024-SPORTS-001').",
    ),
):
    """
    Embed an invisible CAOS watermark into the uploaded image.

    Returns the watermarked JPEG as a binary download.  Asset metadata is
    included in custom response headers.
    """
    _assert_image(file)
    image_bytes = await file.read()

    if len(image_bytes) > _MAX_BYTES:
        raise HTTPException(status_code=413, detail="Image exceeds the 20 MB limit.")

    # ── Embed ────────────────────────────────────────────────────────────────
    try:
        watermarked = caos_core.embed(
            image_bytes, label,
            iterations=_ITERATIONS,
            strength=_STRENGTH,
        )
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc))
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Embedding failed: {exc}")

    # ── Upload to GCS (best-effort) ───────────────────────────────────────────
    asset_id = str(uuid.uuid4())
    try:
        wm_url   = storage.upload_asset(watermarked,   f"{asset_id}_wm.jpg")
        orig_url = storage.upload_asset(image_bytes,   f"{asset_id}_orig.jpg")
    except Exception:
        wm_url = orig_url = "storage_unavailable"

    return Response(
        content=watermarked,
        media_type="image/jpeg",
        headers={
            "X-Asset-ID":        asset_id,
            "X-Asset-URL":       wm_url,
            "X-Original-URL":    orig_url,
            "X-Signature-Label": label,
            "X-Signature-Length": str(len(label)),
            "Content-Disposition": f'attachment; filename="{asset_id}_caos_mark.jpg"',
        },
    )


# ── /verify ───────────────────────────────────────────────────────────────────

@app.post("/verify", tags=["core"])
async def verify(
    file: UploadFile = File(..., description="Suspect image to analyse."),
    suspect_url: str = Form(..., description="URL where the suspect content was found."),
    account_name: str = Form(..., description="Account / entity name."),
    sig_len: int = Form(
        ..., ge=1, le=128,
        description="Expected signature length in **characters** (from the protect call).",
    ),
):
    """
    Extract the CAOS watermark from a suspect image, run Gemini 1.5 Pro
    forensics, log the event to Firestore, and return the full report.
    """
    _assert_image(file)
    image_bytes = await file.read()

    # ── Extract signature ────────────────────────────────────────────────────
    try:
        extracted = caos_core.extract(
            image_bytes, sig_len,
            iterations=_ITERATIONS,
            strength=_STRENGTH,
        )
    except Exception as exc:
        raise HTTPException(status_code=422, detail=f"Signature extraction failed: {exc}")

    # ── Gemini forensics (graceful degradation) ───────────────────────────────
    try:
        forensics_result = forensics.analyze(
            extracted_signature=extracted,
            suspect_url=suspect_url,
            account_name=account_name,
        )
    except Exception as exc:
        forensics_result = {
            "verdict":            "Unknown",
            "risk_score":         5,
            "reasoning":          f"Forensics engine error: {exc}",
            "recommended_action": "Manual Review",
            "confidence":         0.0,
        }

    # ── Log event (best-effort) ───────────────────────────────────────────────
    asset_id = str(uuid.uuid4())
    try:
        event_id = storage.log_verification_event(
            asset_id=asset_id,
            suspect_url=suspect_url,
            account_name=account_name,
            extracted_signature=extracted,
            forensics_result=forensics_result,
        )
    except Exception:
        event_id = "logging_failed"

    return JSONResponse({
        "event_id":            event_id,
        "asset_id":            asset_id,
        "extracted_signature": extracted,
        "suspect_url":         suspect_url,
        "account_name":        account_name,
        "forensics":           forensics_result,
        "timestamp":           datetime.now(timezone.utc).isoformat(),
    })


# ── /events ───────────────────────────────────────────────────────────────────

@app.get("/events", tags=["radar"])
def get_events(limit: int = 50):
    """
    Return the most recent watermark verification events (newest first).
    Feeds the Radar Dashboard in the frontend.
    """
    try:
        events = storage.get_verification_events(limit=min(limit, 100))
        return JSONResponse({"events": events, "count": len(events)})
    except Exception as exc:
        raise HTTPException(
            status_code=500, detail=f"Failed to retrieve events: {exc}"
        )


@app.get("/events/{event_id}", tags=["radar"])
def get_event(event_id: str):
    """Fetch a single verification event by its ID."""
    event = storage.get_event_by_id(event_id)
    if event is None:
        raise HTTPException(status_code=404, detail="Event not found.")
    return JSONResponse(event)

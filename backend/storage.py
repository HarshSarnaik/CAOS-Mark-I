"""
CAOS-Mark Storage Module
========================
Abstracts Google Cloud Storage (asset vault) and Firestore (event log).

LOCAL_FALLBACK mode
-------------------
Set  LOCAL_FALLBACK=true  in your .env to bypass GCP entirely.
Assets are written to ./local_store/ and events to ./local_store/events.json.
This lets you develop and demo the full pipeline without a GCP project.
"""

from __future__ import annotations

import json
import os
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

# ─────────────────────────────────────────────────────────────────────────────
# Configuration
# ─────────────────────────────────────────────────────────────────────────────

LOCAL_FALLBACK: bool = os.getenv("LOCAL_FALLBACK", "false").lower() == "true"
_LOCAL_DIR = Path("./local_store")
_LOCAL_EVENTS = _LOCAL_DIR / "events.json"


# ─────────────────────────────────────────────────────────────────────────────
# Lazy GCP client helpers
# ─────────────────────────────────────────────────────────────────────────────

def _gcs():
    from google.cloud import storage  # type: ignore[import]
    return storage.Client(project=os.getenv("GOOGLE_CLOUD_PROJECT"))


def _firestore():
    from google.cloud import firestore  # type: ignore[import]
    return firestore.Client(project=os.getenv("GOOGLE_CLOUD_PROJECT"))


# ─────────────────────────────────────────────────────────────────────────────
# Local-fallback helpers
# ─────────────────────────────────────────────────────────────────────────────

def _local_load_events() -> list[dict]:
    if _LOCAL_EVENTS.exists():
        return json.loads(_LOCAL_EVENTS.read_text(encoding="utf-8"))
    return []


def _local_save_events(events: list[dict]) -> None:
    _LOCAL_DIR.mkdir(parents=True, exist_ok=True)
    _LOCAL_EVENTS.write_text(
        json.dumps(events, indent=2, default=str), encoding="utf-8"
    )


# ─────────────────────────────────────────────────────────────────────────────
# Public: GCS / asset operations
# ─────────────────────────────────────────────────────────────────────────────

def upload_asset(
    file_bytes: bytes,
    filename: str,
    content_type: str = "image/jpeg",
) -> str:
    """
    Upload raw bytes to GCS (or local disk in fallback mode).

    Returns
    -------
    str
        Public URL (GCS) or ``local://<abs-path>`` (fallback).
    """
    if LOCAL_FALLBACK:
        _LOCAL_DIR.mkdir(parents=True, exist_ok=True)
        dest = _LOCAL_DIR / filename
        dest.write_bytes(file_bytes)
        return f"local://{dest.resolve()}"

    bucket_name = os.getenv("GCS_BUCKET_NAME", "caos-mark-vault")
    client = _gcs()
    bucket = client.bucket(bucket_name)
    blob = bucket.blob(f"assets/{filename}")
    blob.upload_from_string(file_bytes, content_type=content_type)
    blob.make_public()
    return blob.public_url


def download_asset(filename: str) -> bytes | None:
    """
    Download an asset by filename.  Returns ``None`` if not found.
    """
    if LOCAL_FALLBACK:
        dest = _LOCAL_DIR / filename
        return dest.read_bytes() if dest.exists() else None

    bucket_name = os.getenv("GCS_BUCKET_NAME", "caos-mark-vault")
    client = _gcs()
    bucket = client.bucket(bucket_name)
    blob = bucket.blob(f"assets/{filename}")
    if not blob.exists():
        return None
    return blob.download_as_bytes()


# ─────────────────────────────────────────────────────────────────────────────
# Public: Firestore / event log operations
# ─────────────────────────────────────────────────────────────────────────────

def log_verification_event(
    asset_id: str,
    suspect_url: str,
    account_name: str,
    extracted_signature: str,
    forensics_result: dict[str, Any],
) -> str:
    """
    Persist a verification event to Firestore (or local JSON in fallback).

    Returns
    -------
    str
        The auto-generated event ID.
    """
    event_id = str(uuid.uuid4())
    event: dict[str, Any] = {
        "event_id":            event_id,
        "asset_id":            asset_id,
        "suspect_url":         suspect_url,
        "account_name":        account_name,
        "extracted_signature": extracted_signature,
        "verdict":             forensics_result.get("verdict"),
        "risk_score":          forensics_result.get("risk_score"),
        "reasoning":           forensics_result.get("reasoning"),
        "recommended_action":  forensics_result.get("recommended_action"),
        "confidence":          forensics_result.get("confidence"),
        "timestamp":           datetime.now(timezone.utc).isoformat(),
    }

    if LOCAL_FALLBACK:
        events = _local_load_events()
        events.insert(0, event)           # newest first
        _local_save_events(events)
        return event_id

    db = _firestore()
    db.collection("verification_events").document(event_id).set(event)
    return event_id


def get_verification_events(limit: int = 50) -> list[dict[str, Any]]:
    """
    Retrieve the most recent verification events (newest first).

    Parameters
    ----------
    limit : int
        Maximum number of events to return (capped at 100 server-side).
    """
    limit = min(limit, 100)

    if LOCAL_FALLBACK:
        return _local_load_events()[:limit]

    db = _firestore()
    docs = (
        db.collection("verification_events")
        .order_by("timestamp", direction="DESCENDING")
        .limit(limit)
        .stream()
    )
    return [doc.to_dict() for doc in docs]


def get_event_by_id(event_id: str) -> dict[str, Any] | None:
    """Fetch a single event by its ID."""
    if LOCAL_FALLBACK:
        events = _local_load_events()
        for ev in events:
            if ev.get("event_id") == event_id:
                return ev
        return None

    db = _firestore()
    doc = db.collection("verification_events").document(event_id).get()
    return doc.to_dict() if doc.exists else None

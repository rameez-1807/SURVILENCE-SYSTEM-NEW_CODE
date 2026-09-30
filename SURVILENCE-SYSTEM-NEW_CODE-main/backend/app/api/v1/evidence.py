import os
import uuid
import hmac
import hashlib
import time
from datetime import datetime, timezone
from typing import Optional, List
from pathlib import Path

from fastapi import APIRouter, Depends, Query, HTTPException
from fastapi.responses import FileResponse
from sqlalchemy import select, desc
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_db
from app.models.vehicle import VehicleRecord
from app.models.event import Event
from app.schemas.evidence import EvidenceItemResponse, EvidenceListResponse, SignedUrlResponse

router = APIRouter(prefix="/evidence", tags=["Evidence"])

SECRET_SIGNING_KEY = os.getenv("SECRET_KEY", "surveillance-secure-evidence-secret-key-2026")
EVIDENCE_STORAGE_DIR = Path(__file__).resolve().parents[3] / "storage" / "evidence"
EVIDENCE_STORAGE_DIR.mkdir(parents=True, exist_ok=True)


def generate_signed_token(file_ref: str, expires_at: int) -> str:
    message = f"{file_ref}:{expires_at}".encode("utf-8")
    return hmac.new(SECRET_SIGNING_KEY.encode("utf-8"), message, hashlib.sha256).hexdigest()


@router.get("", response_model=EvidenceListResponse)
async def list_evidence(
    search: Optional[str] = Query(None, description="Search plate, employee, or event"),
    type_filter: str = Query("all", description="all, snapshot, or video"),
    camera_filter: str = Query("all", description="Filter by camera name"),
    date_filter: Optional[str] = Query(None, description="YYYY-MM-DD format"),
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
    db: AsyncSession = Depends(get_db)
):
    items: List[EvidenceItemResponse] = []

    # 1. Fetch from Vehicle Records
    veh_query = select(VehicleRecord).where(VehicleRecord.evidence_reference.isnot(None))
    if search:
        veh_query = veh_query.where(VehicleRecord.number_plate.ilike(f"%{search}%"))
    if camera_filter != "all":
        veh_query = veh_query.where(VehicleRecord.camera_name == camera_filter)
    
    veh_query = veh_query.order_by(desc(VehicleRecord.timestamp)).limit(limit)
    veh_result = await db.execute(veh_query)
    vehicles = veh_result.scalars().all()

    for v in vehicles:
        items.append(
            EvidenceItemResponse(
                id=v.id,
                media_type="snapshot",
                detection_type="vehicle",
                event_name=f"{v.vehicle_type.title()} Detection ({v.number_plate})",
                timestamp=v.timestamp,
                camera_name=v.camera_name,
                employee_info=None,
                vehicle_info=v.number_plate,
                evidence_reference=v.evidence_reference or f"evidence_{v.number_plate.lower()}.jpg",
                media_url=f"/api/v1/evidence/media/{v.id}"
            )
        )

    # 2. Fetch from Events
    ev_query = select(Event).where(Event.evidence_reference.isnot(None))
    ev_query = ev_query.order_by(desc(Event.observed_at)).limit(limit)
    ev_result = await db.execute(ev_query)
    events = ev_result.scalars().all()

    for e in events:
        m_type = "video" if str(e.evidence_reference).endswith((".mp4", ".avi")) else "snapshot"
        items.append(
            EvidenceItemResponse(
                id=e.id,
                media_type=m_type,
                detection_type="intrusion" if "intrusion" in str(e.event_type).lower() else "object",
                event_name=str(e.event_type).replace("_", " ").title(),
                timestamp=e.observed_at,
                camera_name="Camera System",
                employee_info=None,
                vehicle_info=None,
                evidence_reference=e.evidence_reference,
                media_url=f"/api/v1/evidence/media/{e.id}"
            )
        )

    # Apply filters
    if date_filter:
        items = [it for it in items if it.timestamp.strftime("%Y-%m-%d") == date_filter]
    if type_filter != "all":
        items = [it for it in items if it.media_type == type_filter]

    items.sort(key=lambda x: x.timestamp, reverse=True)
    return EvidenceListResponse(total=len(items), items=items[skip : skip + limit])


@router.get("/media/{evidence_id}")
async def view_evidence_media(evidence_id: uuid.UUID, db: AsyncSession = Depends(get_db)):
    """Directly serves the evidence photo/video for browser preview."""
    veh_res = await db.execute(select(VehicleRecord).where(VehicleRecord.id == evidence_id))
    veh = veh_res.scalar_one_or_none()

    if not veh:
        ev_res = await db.execute(select(Event).where(Event.id == evidence_id))
        ev = ev_res.scalar_one_or_none()
        file_name = ev.evidence_reference if ev else None
    else:
        file_name = veh.evidence_reference

    if not file_name:
        raise HTTPException(status_code=404, detail="Evidence not found")

    file_path = EVIDENCE_STORAGE_DIR / file_name
    if not file_path.exists():
        # Smart search: Agar file direct path par na mile toh subfolders me check karega
        found_files = list(EVIDENCE_STORAGE_DIR.rglob(Path(file_name).name))
        if found_files:
            file_path = found_files[0]
        else:
            raise HTTPException(status_code=404, detail="Media file not found on disk")

    media_type = "video/mp4" if str(file_name).endswith(".mp4") else "image/jpeg"
    return FileResponse(path=str(file_path), media_type=media_type)


@router.post("/signed-url/{evidence_id}", response_model=SignedUrlResponse)
async def generate_download_signed_url(evidence_id: uuid.UUID):
    expires_at = int(time.time()) + 300
    token = generate_signed_token(str(evidence_id), expires_at)
    signed_url = f"/api/v1/evidence/download/{evidence_id}?expires={expires_at}&token={token}"
    return SignedUrlResponse(evidence_id=evidence_id, download_url=signed_url, expires_in_seconds=300)


@router.get("/download/{evidence_id}")
async def download_evidence(
    evidence_id: uuid.UUID,
    expires: int = Query(...),
    token: str = Query(...),
    db: AsyncSession = Depends(get_db)
):
    if time.time() > expires:
        raise HTTPException(status_code=403, detail="Download link has expired.")

    expected_token = generate_signed_token(str(evidence_id), expires)
    if not hmac.compare_digest(token, expected_token):
        raise HTTPException(status_code=403, detail="Invalid download token.")

    veh_res = await db.execute(select(VehicleRecord).where(VehicleRecord.id == evidence_id))
    veh = veh_res.scalar_one_or_none()
    file_name = veh.evidence_reference if veh else f"{evidence_id}.jpg"
    file_path = EVIDENCE_STORAGE_DIR / file_name
    if not file_path.exists():
        found_files = list(EVIDENCE_STORAGE_DIR.rglob(Path(file_name).name))
        if found_files:
            file_path = found_files[0]
        else:
            raise HTTPException(status_code=404, detail="File not found on disk.")

    return FileResponse(path=str(file_path), filename=file_name, media_type="image/jpeg")

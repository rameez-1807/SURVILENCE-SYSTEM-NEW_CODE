import re
import uuid
from typing import Optional, List
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import CurrentUser, get_db
from app.schemas.vehicle import (
    VehicleCreate,
    VehicleOut,
    VehicleListResponse,
    VehicleStats,
    ANPRScanRequest,
    ANPRScanResponse,
    WatchlistEntry,
    ANPREngineInfo,
    ANPRBenchmarkResponse
)
from app.services.vehicle import VehicleService
from app.services.anpr.engine_manager import anpr_manager
from app.services.anpr.benchmark import run_anpr_benchmark

router = APIRouter(prefix="/vehicles", tags=["Vehicles / ANPR"])


@router.get("/engines", response_model=List[ANPREngineInfo])
async def list_anpr_engines():
    """
    Returns all registered ANPR engines (Indian ANPR, FastALPR, and YOLO+EasyOCR).
    """
    return anpr_manager.list_engines()


@router.get("/benchmark", response_model=ANPRBenchmarkResponse)
async def get_engines_benchmark():
    """
    Returns authentic benchmark comparison results comparing exact full-plate accuracy
    and latency of all three engines on identical labelled Indian plate images (using persisted results if available).
    """
    try:
        report = run_anpr_benchmark(use_cache=True)
        return report
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"ANPR benchmark retrieval failed: {str(e)}"
        )


@router.post("/benchmark", response_model=ANPRBenchmarkResponse)
async def run_engines_benchmark():
    """
    Forces live re-execution of the benchmark across all three engines on the labelled dataset.
    """
    try:
        report = run_anpr_benchmark(use_cache=False)
        return report
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"ANPR benchmark re-run failed: {str(e)}"
        )


@router.get("", response_model=VehicleListResponse)
async def list_vehicles(
    search: Optional[str] = Query(None, description="Search by license plate number"),
    vehicle_type: Optional[str] = Query(None, description="Filter by vehicle type (car, truck, bus, motorcycle)"),
    camera_name: Optional[str] = Query(None, description="Filter by camera source"),
    location_spot: Optional[str] = Query(None, description="Filter by location spot"),
    date_filter: Optional[str] = Query(None, description="Filter by date (YYYY-MM-DD)"),
    limit: int = Query(100, ge=1, le=500),
    offset: int = Query(0, ge=0),
    db: AsyncSession = Depends(get_db)
):
    """
    List all scanned vehicle records with search and filtering.
    """
    total, items = await VehicleService.list_vehicles(
        db=db,
        search=search,
        vehicle_type=vehicle_type,
        camera_name=camera_name,
        location_spot=location_spot,
        date_filter=date_filter,
        limit=limit,
        offset=offset
    )
    return VehicleListResponse(total=total, items=items)


@router.get("/stats", response_model=VehicleStats)
async def get_vehicle_stats(db: AsyncSession = Depends(get_db)):
    """
    Get ANPR system daily statistics.
    """
    return await VehicleService.get_stats(db=db)


@router.post("/scan", response_model=ANPRScanResponse)
async def scan_vehicle_plate(
    payload: ANPRScanRequest,
    db: AsyncSession = Depends(get_db)
):
    """
    Scan a car or bike number plate (via uploaded base64 image or manual input),
    perform ANPR text extraction using the selected engine (indian_anpr, fast_alpr, or yolo_easyocr),
    save the record permanently to the database without duplicates,
    and return the scanned detection result.
    """
    try:
        success, record, message, details = await VehicleService.scan_and_save(
            db=db,
            image_base64=payload.image_base64,
            manual_plate=payload.manual_plate,
            vehicle_type=payload.vehicle_type,
            camera_name=payload.camera_name or "Live ANPR Camera",
            location_spot=payload.location_spot or "Apartment Main Gate",
            is_live_stream=bool(payload.is_live_stream),
            engine=payload.engine or "indian_anpr"
        )
        if not success or not record:
            return ANPRScanResponse(
                success=False,
                engine=details.get("engine", payload.engine),
                processing_time_ms=details.get("processing_time_ms", 0.0),
                message=message or "No license plate detected in frame."
            )
        return ANPRScanResponse(
            success=True,
            number_plate=record.number_plate,
            vehicle_type=record.vehicle_type,
            confidence=record.confidence,
            location_spot=record.location_spot,
            bounding_box=details.get("bounding_box"),
            cropped_plate_base64=details.get("cropped_plate_base64"),
            is_valid_format=details.get("is_valid_format", False),
            raw_ocr_text=details.get("raw_ocr_text"),
            already_saved=details.get("already_saved", False),
            security_status=details.get("security_status"),
            consensus_frames=details.get("consensus_frames"),
            consensus_plate=details.get("consensus_plate"),
            engine=details.get("engine", payload.engine),
            processing_time_ms=details.get("processing_time_ms", 0.0),
            message=message,
            record=record
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"ANPR plate scanning failed: {str(e)}"
        )


@router.post("", response_model=VehicleOut, status_code=status.HTTP_201_CREATED)
async def create_vehicle_record(
    data: VehicleCreate,
    current_user: CurrentUser,
    db: AsyncSession = Depends(get_db)
):
    """
    Manually register a vehicle record in the database.
    """
    return await VehicleService.create_vehicle(db=db, data=data)


@router.delete("", status_code=status.HTTP_200_OK)
async def clear_all_vehicles(
    current_user: CurrentUser,
    db: AsyncSession = Depends(get_db)
):
    """
    Delete ALL vehicle records from the database.
    """
    deleted_count = await VehicleService.clear_all_vehicles(db=db)
    return {"status": "cleared", "deleted_count": deleted_count}


@router.delete("/{vehicle_id}")
async def delete_vehicle_record(
    vehicle_id: uuid.UUID,
    current_user: CurrentUser,
    db: AsyncSession = Depends(get_db)
):
    """
    Delete a vehicle record from the database.
    """
    deleted = await VehicleService.delete_vehicle(db=db, vehicle_id=vehicle_id)
    if not deleted:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Vehicle record not found")
    return {"status": "deleted", "id": str(vehicle_id)}


@router.get("/security/watchlist")
async def get_watchlist():
    """
    Returns enterprise access control watchlist (BLACKLIST, RESIDENT, VIP, VISITOR).
    """
    return VehicleService.SECURITY_WATCHLIST


@router.post("/security/watchlist")
async def set_watchlist_entry(entry: WatchlistEntry, current_user: CurrentUser):
    """
    Registers or updates a vehicle plate in the enterprise access control list.
    """
    clean = re.sub(r'[^A-Za-z0-9]', '', entry.number_plate).upper()
    VehicleService.SECURITY_WATCHLIST[clean] = entry.category.upper()
    return {"status": "success", "plate": clean, "category": entry.category.upper()}


@router.delete("/security/watchlist/{number_plate}")
async def remove_watchlist_entry(number_plate: str, current_user: CurrentUser):
    """
    Removes a vehicle plate from the security watchlist.
    """
    clean = re.sub(r'[^A-Za-z0-9]', '', number_plate).upper()
    if clean in VehicleService.SECURITY_WATCHLIST:
        del VehicleService.SECURITY_WATCHLIST[clean]
    return {"status": "removed", "plate": clean}

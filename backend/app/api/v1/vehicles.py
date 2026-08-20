import uuid
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_db
from app.schemas.vehicle import (
    VehicleCreate,
    VehicleOut,
    VehicleListResponse,
    VehicleStats,
    ANPRScanRequest,
    ANPRScanResponse
)
from app.services.vehicle import VehicleService

router = APIRouter(prefix="/vehicles", tags=["Vehicles / ANPR"])


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
    Scan a car number plate (via uploaded base64 image or manual input),
    perform ANPR text extraction, save the record permanently to the database,
    and return the scanned detection result.
    """
    try:
        success, record, message = await VehicleService.scan_and_save(
            db=db,
            image_base64=payload.image_base64,
            manual_plate=payload.manual_plate,
            vehicle_type=payload.vehicle_type,
            camera_name=payload.camera_name or "Live ANPR Camera",
            location_spot=payload.location_spot or "Apartment Main Gate"
        )
        if not success or not record:
            return ANPRScanResponse(
                success=False,
                message=message or "No license plate detected in frame."
            )
        return ANPRScanResponse(
            success=True,
            number_plate=record.number_plate,
            vehicle_type=record.vehicle_type,
            confidence=record.confidence,
            location_spot=record.location_spot,
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
    db: AsyncSession = Depends(get_db)
):
    """
    Manually register a vehicle record in the database.
    """
    return await VehicleService.create_vehicle(db=db, data=data)


@router.delete("", status_code=status.HTTP_200_OK)
async def clear_all_vehicles(db: AsyncSession = Depends(get_db)):
    """
    Delete ALL vehicle records from the database.
    """
    deleted_count = await VehicleService.clear_all_vehicles(db=db)
    return {"status": "cleared", "deleted_count": deleted_count}


@router.delete("/{vehicle_id}")
async def delete_vehicle_record(
    vehicle_id: uuid.UUID,
    db: AsyncSession = Depends(get_db)
):
    """
    Delete a vehicle record from the database.
    """
    deleted = await VehicleService.delete_vehicle(db=db, vehicle_id=vehicle_id)
    if not deleted:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Vehicle record not found")
    return {"status": "deleted", "id": str(vehicle_id)}

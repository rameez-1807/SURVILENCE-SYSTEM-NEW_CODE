import uuid
from datetime import datetime
from typing import Optional, List
from pydantic import BaseModel, ConfigDict, Field


class VehicleCreate(BaseModel):
    number_plate: str = Field(..., description="Vehicle license plate number")
    vehicle_type: str = Field(default="car", description="Vehicle type (car, truck, bus, motorcycle, bicycle)")
    confidence: float = Field(default=0.92, description="ANPR recognition confidence score (0.0 to 1.0)")
    camera_name: str = Field(default="Live ANPR Camera", description="Camera or feed source name")
    location_spot: str = Field(default="Apartment Main Gate", description="Location spot (e.g. Visitor Parking, Apartment Main Gate, Basement B2)")
    evidence_reference: Optional[str] = Field(default=None, description="Optional image/evidence reference or URL")


class VehicleOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    number_plate: str
    vehicle_type: str
    confidence: float
    camera_name: str
    location_spot: str = "Apartment Main Gate"
    evidence_reference: Optional[str] = None
    timestamp: datetime
    created_at: datetime


class VehicleListResponse(BaseModel):
    total: int
    items: List[VehicleOut]


class VehicleStats(BaseModel):
    total_vehicles: int
    unique_plates: int
    watchlist_hits: int
    car_count: int
    truck_count: int
    bus_count: int
    motorcycle_count: int


class ANPRScanRequest(BaseModel):
    image_base64: Optional[str] = Field(default=None, description="Base64 encoded vehicle plate image")
    manual_plate: Optional[str] = Field(default=None, description="Direct/manual plate input if overriding image OCR")
    vehicle_type: Optional[str] = Field(default="car", description="Vehicle type if specified")
    camera_name: Optional[str] = Field(default="Live ANPR Camera", description="Camera source name")
    location_spot: Optional[str] = Field(default="Apartment Main Gate", description="Location spot (e.g., Visitor Parking, Apartment Gate)")


class ANPRScanResponse(BaseModel):
    success: bool
    number_plate: Optional[str] = None
    vehicle_type: Optional[str] = None
    confidence: Optional[float] = None
    location_spot: Optional[str] = None
    message: str
    record: Optional[VehicleOut] = None

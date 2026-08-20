import asyncio
from app.db.session import async_session_factory
from app.services.vehicle import VehicleService
from app.schemas.vehicle import VehicleCreate

async def test_vehicles():
    async with async_session_factory() as db:
        print("Testing ANPR Scan and DB Save...")
        scanned = await VehicleService.scan_and_save(
            db=db,
            manual_plate="MH12AB1234",
            vehicle_type="car",
            camera_name="Entrance Gate ANPR"
        )
        print(f"Scanned & Saved: ID={scanned.id}, Plate={scanned.number_plate}, Confidence={scanned.confidence}")

        total, items = await VehicleService.list_vehicles(db)
        print(f"Total Vehicles in DB: {total}")
        for item in items[:5]:
            print(f" - {item.number_plate} ({item.vehicle_type}) | {item.confidence*100:.1f}% | {item.timestamp}")

        stats = await VehicleService.get_stats(db)
        print(f"Stats: Total={stats.total_vehicles}, Unique={stats.unique_plates}, Watchlist={stats.watchlist_hits}")

if __name__ == "__main__":
    asyncio.run(test_vehicles())

from datetime import datetime
from typing import Dict, Any, List

def evaluate_schedule(observed_at: datetime, schedule_config: Dict[str, Any]) -> bool:
    """
    Evaluates if the observed timestamp falls within the schedule configuration.
    Expects schedule_config format:
    {
        "days": ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"],
        "start_time": "18:00",
        "end_time": "06:00"
    }
    """
    if not schedule_config:
        return True

    # 1. Day of week check
    allowed_days = schedule_config.get("days")
    if allowed_days:
        day_str = observed_at.strftime("%a") # "Mon", "Tue", etc.
        if day_str not in allowed_days:
            return False

    # 2. Time of day check
    start_time_str = schedule_config.get("start_time")
    end_time_str = schedule_config.get("end_time")
    
    if start_time_str and end_time_str:
        current_time = observed_at.time()
        start_time = datetime.strptime(start_time_str, "%H:%M").time()
        end_time = datetime.strptime(end_time_str, "%H:%M").time()
        
        # Handle overnight schedules (e.g., 18:00 to 06:00)
        if start_time > end_time:
            if not (current_time >= start_time or current_time <= end_time):
                return False
        else:
            if not (start_time <= current_time <= end_time):
                return False
                
    return True


def _point_in_polygon(x: float, y: float, polygon: List[List[float]]) -> bool:
    """
    Ray-casting algorithm to determine if a point is inside a polygon.
    """
    n = len(polygon)
    inside = False
    
    p1x, p1y = polygon[0]
    for i in range(1, n + 1):
        p2x, p2y = polygon[i % n]
        if y > min(p1y, p2y):
            if y <= max(p1y, p2y):
                if x <= max(p1x, p2x):
                    if p1y != p2y:
                        xinters = (y - p1y) * (p2x - p1x) / (p2y - p1y) + p1x
                    if p1x == p2x or x <= xinters:
                        inside = not inside
        p1x, p1y = p2x, p2y
        
    return inside


def evaluate_zone(bbox: List[float], zone_config: Dict[str, Any]) -> bool:
    """
    Evaluates if the detection bounding box intersects/is inside the zone.
    bbox format: [x_min, y_min, x_max, y_max]
    zone_config format: 
    {
        "polygons": [
            [[x1, y1], [x2, y2], [x3, y3], ...],
            ...
        ]
    }
    """
    if not zone_config or "polygons" not in zone_config:
        return True
        
    polygons = zone_config["polygons"]
    if not polygons:
        return True
        
    # Calculate center of bounding box
    x_min, y_min, x_max, y_max = bbox
    cx = (x_min + x_max) / 2.0
    cy = (y_min + y_max) / 2.0
    
    # Check if center point is in ANY of the defined polygons (OR logic)
    for polygon in polygons:
        if _point_in_polygon(cx, cy, polygon):
            return True
            
    return False

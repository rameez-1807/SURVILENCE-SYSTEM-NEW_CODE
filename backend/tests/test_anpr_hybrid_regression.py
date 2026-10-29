import pytest
from app.services.anpr.engine_manager import anpr_manager
from app.services.anpr.base import BaseANPREngine
from app.schemas.vehicle import ANPRScanRequest

def test_anpr_engines_registered():
    engines = anpr_manager.list_engines()
    engine_ids = [e["id"] for e in engines]
    assert "yolo_easyocr" in engine_ids
    assert "hybrid_anpr" in engine_ids
    assert "fast_alpr" in engine_ids
    assert "indian_anpr" in engine_ids

def test_default_anpr_engine_is_yolo_easyocr():
    assert anpr_manager.DEFAULT_ENGINE == "yolo_easyocr"
    default_engine = anpr_manager.get_engine()
    assert default_engine.engine_id == "yolo_easyocr"

def test_hybrid_anpr_engine_conforms_to_interface():
    engine = anpr_manager.get_engine("hybrid_anpr")
    assert isinstance(engine, BaseANPREngine)
    assert engine.name == "Hybrid ANPR (YOLO + Awiros + EasyOCR Fallback)"
    assert engine.engine_id == "hybrid_anpr"

def test_vehicle_scan_request_schema_supports_hybrid():
    req1 = ANPRScanRequest(image_base64="dummy", engine="hybrid_anpr")
    assert req1.engine == "hybrid_anpr"
    req2 = ANPRScanRequest(image_base64="dummy", engine="yolo_easyocr")
    assert req2.engine == "yolo_easyocr"
    req_default = ANPRScanRequest(image_base64="dummy")
    assert req_default.engine == "yolo_easyocr"

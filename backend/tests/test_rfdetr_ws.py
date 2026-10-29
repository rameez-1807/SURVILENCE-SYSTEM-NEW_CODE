"""
Comprehensive Test for RF-DETR-Nano & RF-DETR-2XL Safety in WebSocket Pipeline.
"""
import base64
import os
import cv2
import pytest
from fastapi.testclient import TestClient
from app.main import create_app

def test_rfdetr_websocket_pipeline():
    app = create_app()
    client = TestClient(app)

    # Encode test image
    img_path = os.path.abspath(os.path.join(os.path.dirname(__file__), "../../laptop.webp"))
    if not os.path.exists(img_path):
        img_path = "laptop.webp"
    img = cv2.imread(img_path)
    assert img is not None, f"laptop.webp must exist at {img_path}"
    _, buffer = cv2.imencode(".jpg", img)
    b64_str = base64.b64encode(buffer).decode("utf-8")

    print("\n[TEST] Connecting to /api/v1/ws/object-detection...")
    with client.websocket_connect("/api/v1/ws/object-detection") as ws:
        # Test 1: Send RF-DETR-Nano inference frame
        print("[TEST] Sending RF-DETR-Nano frame...")
        ws.send_json({
            "frame": b64_str,
            "model": "rfdetr_nano",
            "confidence": 0.35,
            "auto_save": False,
        })
        resp = ws.receive_json()
        print("[TEST] RF-DETR-Nano response:", {k: resp.get(k) for k in ("model", "inference_ms", "active_tracks")})
        assert "error" not in resp, f"Expected no error, got: {resp.get('error')}"
        assert resp.get("model") == "rfdetr-nano"
        dets = resp.get("detections", [])
        assert len(dets) >= 1, f"Expected >= 1 detection, got: {len(dets)}"
        names = [d["name"] for d in dets]
        assert "laptop" in names, f"Expected 'laptop' in detections, got {names}"
        laptop_det = next(d for d in dets if d["name"] == "laptop")
        assert laptop_det.get("track_id") is not None, "Expected persistent ByteTrack track_id"
        print(f"[TEST] Confirmed RF-DETR-Nano + ByteTrack: {laptop_det['name']} (conf={laptop_det['confidence']*100:.1f}%, track_id={laptop_det['track_id']})")

        # Test 2: ByteTrack persistence across frames
        for frame_num in range(2, 4):
            ws.send_json({
                "frame": b64_str,
                "model": "rfdetr_nano",
                "confidence": 0.35,
                "auto_save": False,
            })
            resp2 = ws.receive_json()
            assert "error" not in resp2
            dets2 = resp2.get("detections", [])
            assert len(dets2) >= 1
            assert dets2[0].get("track_id") == laptop_det["track_id"], "Track ID must remain persistent across frames"

        # Test 3: RF-DETR-2XL safety gate rejection on CPU
        print("[TEST] Testing RF-DETR-2XL safety gate...")
        ws.send_json({
            "frame": b64_str,
            "model": "rfdetr_2xl",
            "confidence": 0.35,
            "auto_save": False,
        })
        resp_2xl = ws.receive_json()
        print("[TEST] RF-DETR-2XL response:", resp_2xl)
        assert "error" in resp_2xl, "Expected safety error for 2XL on CPU-only host"
        assert "RF-DETR-2XL unavailable" in resp_2xl["error"]

        # Test 4: Regression test - existing YOLO11m continues working
        print("[TEST] Regression test: Sending YOLO11m frame...")
        ws.send_json({
            "frame": b64_str,
            "model": "yolo11m",
            "confidence": 0.35,
            "auto_save": False,
        })
        resp_11m = ws.receive_json()
        assert "error" not in resp_11m, f"YOLO11m failed: {resp_11m.get('error')}"
        assert resp_11m.get("model") == "yolo11m"
        print("[TEST] YOLO11m regression test passed")

    print("\n[TEST] ALL RF-DETR WEBSOCKET & SAFETY TESTS PASSED!")

if __name__ == "__main__":
    test_rfdetr_websocket_pipeline()


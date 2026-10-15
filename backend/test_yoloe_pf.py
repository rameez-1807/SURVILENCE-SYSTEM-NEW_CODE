import cv2
import time
from app.core.ai.yoloe_singleton import load_model, track_frame, get_model_info, get_active_classes

load_model()
img = cv2.imread("../laptop.webp")

if img is not None:
    # Warmup already done, test 3 frames
    for i in range(3):
        start = time.perf_counter()
        res = track_frame("bench_sess", img, confidence=0.25)
        ms = (time.perf_counter() - start) * 1000
        print(f"Frame #{i+1}: inference={res['inference_ms']}ms, total={ms:.1f}ms, dets={len(res['detections'])}")

# YOLO26s live object detection — integration instructions

This feature branch adds YOLO26s to the existing browser-camera model selector, FastAPI WebSocket and ByteTrack-confirmed event persistence. No production deployment or model inference has been verified yet.

## Installation and local testing

1. Use a **separate virtual environment** or test instance and ensure no sensitive configuration from `backend/app/core/config.py` is committed. Rotate exposed database credentials and authentication signing keys before deploying.
2. From the repository's backend directory, install compatible project requirements first and then an Ultralytics version **that supports YOLO26**. The existing backend pins only a lower bound (`ultralytics>=8.2.0`), which is insufficient to guarantee this model's availability.

   ```bash
   cd backend
   python -m pip install -r requirements.txt
   python -m pip install -U ultralytics
   python -c "from ultralytics import YOLO; m=YOLO('yolo26s.pt'); print(m.names)"
   ```

3. With a CPU-only EC2 instance, benchmark `yolo26s.pt` against `yolo26n.pt`. For consistent 8 GiB memory use, configure a single inference worker to start. Weights are lazily downloaded and should be cached or pre-provisioned for production.
4. To use an exported ONNX file instead, run `YOLO('yolo26s.pt').export(format='onnx', imgsz=640)`, install `onnxruntime` and set `YOLO26_MODEL_PATH=/absolute/path/to/yolo26s.onnx`. ONNX is optional, and may not be faster on all CPU types.
5. Start the FastAPI server from backend as usual, connect the frontend, navigate to Objects → live mode → **YOLO26s + ByteTrack**. The WebSocket payload is the same as existing models, with `model: "yolo26s"`.
6. Run multiple sequential frames to establish ByteTrack IDs and confirm `new_confirmed` events. Validate the `events` MongoDB collection and existing SQL event collection separately. Check memory usage and camera latency.

## Design

The new `backend/app/core/ai/yolo26_singleton.py` uses a lazy singleton for the YOLO26 model, serializes shared-model inference, and reuses the existing YOLOE session tracker class without loading the YOLOE neural network. It outputs the existing `detections/counts/new_confirmed/model/inference_ms` response format so the existing WebSocket persistence and frontend overlays can work unchanged.

Other active clients using different models may trigger the existing global model-eviction logic; test model switching and concurrent sessions before production use. This is an initial integration, not a load-tested production guarantee. CPU inference for an 8 GiB AWS instance might be slow.

## Validation checklist

- Model weight download + import
- Live WebSocket response fields
- Webcam overlay bounding boxes/class names
- Track IDs across multiple frames
- MongoDB events inserted after confirmed tracking
- Concurrent camera sessions / model switching
- CPU memory, inference latency, frontend frame rate
- License review for Ultralytics weights and application deployment

"""
AI Surveillance System - Detection & Pipeline Metrics Collector

Thread-safe telemetry aggregator tracking:
- camera_fps
- inference_fps
- inference_latency_ms (avg & p95)
- detection_count
- active_tracks
- event_count
- dropped_frames
- camera_reconnect_count
- GPU / CPU memory stats
"""

import logging
import threading
import time
import uuid
from collections import deque
from typing import Any, Dict, List, Optional

logger = logging.getLogger(__name__)


class DetectionMetricsCollector:
    """Singleton collector for real-time video analytics performance metrics."""

    _instance = None
    _lock = threading.Lock()

    def __new__(cls):
        with cls._lock:
            if cls._instance is None:
                cls._instance = super(DetectionMetricsCollector, cls).__new__(cls)
                cls._instance._init_state()
            return cls._instance

    def _init_state(self):
        self._latencies: deque = deque(maxlen=300)
        self._fps_timestamps: deque = deque(maxlen=100)
        self._state_lock = threading.Lock()

        # Global Counters
        self.total_detections = 0
        self.total_events = 0
        self.total_frames_processed = 0
        self.dropped_frames = 0
        self.camera_reconnects = 0

        # Per-camera metrics: camera_id -> dict
        self._camera_stats: Dict[str, Dict[str, Any]] = {}
        self.start_time = time.time()

    def record_inference(self, latency_ms: float, detections_count: int, camera_id: Optional[uuid.UUID] = None):
        """Record an inference run."""
        now = time.time()
        with self._state_lock:
            self._latencies.append(latency_ms)
            self._fps_timestamps.append(now)
            self.total_detections += detections_count
            self.total_frames_processed += 1

            if camera_id:
                cid = str(camera_id)
                if cid not in self._camera_stats:
                    self._camera_stats[cid] = {
                        "detections": 0,
                        "frames": 0,
                        "last_latency_ms": 0.0,
                        "active_tracks": 0,
                        "last_seen": now,
                    }
                self._camera_stats[cid]["detections"] += detections_count
                self._camera_stats[cid]["frames"] += 1
                self._camera_stats[cid]["last_latency_ms"] = round(latency_ms, 2)
                self._camera_stats[cid]["last_seen"] = now

    def record_event(self):
        with self._state_lock:
            self.total_events += 1

    def record_dropped_frame(self):
        with self._state_lock:
            self.dropped_frames += 1

    def record_reconnect(self):
        with self._state_lock:
            self.camera_reconnects += 1

    def update_active_tracks(self, camera_id: uuid.UUID, active_count: int):
        with self._state_lock:
            cid = str(camera_id)
            if cid not in self._camera_stats:
                self._camera_stats[cid] = {
                    "detections": 0,
                    "frames": 0,
                    "last_latency_ms": 0.0,
                    "active_tracks": active_count,
                    "last_seen": time.time(),
                }
            else:
                self._camera_stats[cid]["active_tracks"] = active_count

    def get_summary(self) -> Dict[str, Any]:
        """Returns comprehensive status dictionary for API and Dashboard."""
        now = time.time()
        with self._state_lock:
            # Calculate inference FPS based on last N timestamps
            inf_fps = 0.0
            if len(self._fps_timestamps) > 1:
                timespan = self._fps_timestamps[-1] - self._fps_timestamps[0]
                if timespan > 0:
                    inf_fps = round((len(self._fps_timestamps) - 1) / timespan, 1)

            # Average & P95 Latency
            lat_list = list(self._latencies)
            avg_latency = round(sum(lat_list) / len(lat_list), 2) if lat_list else 0.0
            p95_latency = round(sorted(lat_list)[int(len(lat_list) * 0.95)], 2) if len(lat_list) >= 20 else avg_latency

            # Sum of active tracks
            total_active_tracks = sum(c.get("active_tracks", 0) for c in self._camera_stats.values())

            # GPU Check
            gpu_info = {"available": False, "device": "CPU", "memory_allocated_mb": 0}
            try:
                import torch
                if torch.cuda.is_available():
                    gpu_info = {
                        "available": True,
                        "device": torch.cuda.get_device_name(0),
                        "memory_allocated_mb": round(torch.cuda.memory_allocated(0) / (1024 * 1024), 2),
                        "memory_reserved_mb": round(torch.cuda.memory_reserved(0) / (1024 * 1024), 2),
                    }
            except Exception:
                pass

            uptime_sec = int(now - self.start_time)

            return {
                "status": "healthy",
                "uptime_seconds": uptime_sec,
                "inference_fps": inf_fps,
                "avg_inference_latency_ms": avg_latency,
                "p95_inference_latency_ms": p95_latency,
                "total_detections": self.total_detections,
                "total_frames_processed": self.total_frames_processed,
                "total_events": self.total_events,
                "dropped_frames": self.dropped_frames,
                "camera_reconnect_count": self.camera_reconnects,
                "active_tracks": total_active_tracks,
                "gpu_metrics": gpu_info,
                "camera_count": len(self._camera_stats),
                "cameras": dict(self._camera_stats),
            }


metrics_collector = DetectionMetricsCollector()

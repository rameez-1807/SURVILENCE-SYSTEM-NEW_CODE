"""
Benchmark suite comparing exact full-plate accuracy of all three ANPR engines:
  1. Indian ANPR (fine-tuned YOLO + multi-pass OCR & Indian plate post-processing)
  2. FastALPR (high-performance ONNX end-to-end detector & transformer OCR)
  3. YOLO + EasyOCR (original surveillance system backup engine)

All evaluations are executed sequentially on the exact same labelled Indian plate images.
Results are strictly authentic and measured directly from model inference.
"""

from __future__ import annotations

import csv
import json
import logging
import time
from pathlib import Path
from typing import Dict, List, Any, Optional

import cv2
import numpy as np

from app.services.anpr.engine_manager import anpr_manager

logger = logging.getLogger(__name__)


def _levenshtein_distance(s1: str, s2: str) -> int:
    """Computes Levenshtein edit distance between two strings."""
    if len(s1) < len(s2):
        return _levenshtein_distance(s2, s1)
    if len(s2) == 0:
        return len(s1)

    previous_row = range(len(s2) + 1)
    for i, c1 in enumerate(s1):
        current_row = [i + 1]
        for j, c2 in enumerate(s2):
            insertions = previous_row[j + 1] + 1
            deletions = current_row[j] + 1
            substitutions = previous_row[j] + (c1 != c2)
            current_row.append(min(insertions, deletions, substitutions))
        previous_row = current_row

    return previous_row[-1]


def run_anpr_benchmark(
    custom_dataset_dir: Optional[Path] = None,
    engines_to_test: Optional[List[str]] = None,
    use_cache: bool = False
) -> Dict[str, Any]:
    """
    Executes benchmark comparison across all three engines on identical labelled Indian plate images.
    If use_cache is True and benchmark_results.json exists, returns the persisted authentic results.
    """
    base_dir = custom_dataset_dir or Path(__file__).resolve().parent / "benchmark_data"
    report_path = base_dir / "benchmark_results.json"

    if use_cache and report_path.exists():
        try:
            with open(report_path, "r", encoding="utf-8") as f:
                return json.load(f)
        except Exception as e:
            logger.warning(f"[Benchmark] Failed to load cached benchmark results: {e}")

    img_dir = base_dir / "images"
    csv_file = base_dir / "ground_truth.csv"

    if not csv_file.exists():
        raise FileNotFoundError(f"Benchmark ground truth file not found at: {csv_file}")

    # Load labelled items
    items: List[Dict[str, str]] = []
    with open(csv_file, "r", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        for row in reader:
            items.append(row)

    if not items:
        raise ValueError(f"No test items found in ground_truth.csv ({csv_file})")

    engine_ids = engines_to_test or ["yolo_easyocr", "hybrid_anpr", "fast_alpr", "indian_anpr"]
    engines = {eid: anpr_manager.get_engine(eid) for eid in engine_ids}

    # Tracking metrics per engine
    stats: Dict[str, Dict[str, Any]] = {
        eid: {
            "name": engines[eid].name,
            "exact_matches": 0,
            "char_accuracies": [],
            "latencies_ms": [],
            "total_tested": 0
        }
        for eid in engine_ids
    }

    detailed_results = []

    for item in items:
        fname = item["filename"]
        expected = item["expected_plate"].strip().upper().replace(" ", "")
        vtype = item.get("vehicle_type", "car")
        img_path = img_dir / fname

        if not img_path.exists():
            logger.warning(f"Benchmark image not found: {img_path}")
            continue

        frame = cv2.imread(str(img_path))
        if frame is None:
            logger.warning(f"Failed to read image: {img_path}")
            continue

        row_preds = {}

        for eid in engine_ids:
            engine = engines[eid]
            t_start = time.perf_counter()
            res = engine.detect_and_read(frame)
            elapsed_ms = round((time.perf_counter() - t_start) * 1000, 1)

            pred_plate = (res.plate or "").strip().upper().replace(" ", "")
            is_exact = (pred_plate == expected)

            # Character accuracy
            max_len = max(len(expected), len(pred_plate), 1)
            dist = _levenshtein_distance(expected, pred_plate)
            char_acc = max(0.0, 100.0 * (1.0 - dist / max_len))

            stats[eid]["total_tested"] += 1
            if is_exact:
                stats[eid]["exact_matches"] += 1
            stats[eid]["char_accuracies"].append(char_acc)
            stats[eid]["latencies_ms"].append(elapsed_ms)

            row_preds[eid] = {
                "plate": res.plate,
                "raw_plate": res.raw_plate,
                "exact_match": is_exact,
                "confidence": res.confidence,
                "latency_ms": elapsed_ms,
                "is_valid_format": res.is_valid_format,
                "vehicle_type": res.vehicle_type
            }

        detailed_results.append({
            "filename": fname,
            "expected": expected,
            "vehicle_type": vtype,
            "predictions": row_preds
        })

    # Compute summaries
    summaries = {}
    for eid in engine_ids:
        total = stats[eid]["total_tested"]
        exact = stats[eid]["exact_matches"]
        acc_pct = round((exact / total * 100.0), 2) if total > 0 else 0.0
        avg_char = round(float(np.mean(stats[eid]["char_accuracies"])), 2) if stats[eid]["char_accuracies"] else 0.0
        avg_lat = round(float(np.mean(stats[eid]["latencies_ms"])), 1) if stats[eid]["latencies_ms"] else 0.0

        summaries[eid] = {
            "name": stats[eid]["name"],
            "total_tested": total,
            "exact_matches": exact,
            "exact_accuracy_pct": acc_pct,
            "avg_char_accuracy_pct": avg_char,
            "avg_latency_ms": avg_lat
        }

    report = {
        "timestamp": time.strftime("%Y-%m-%d %H:%M:%S"),
        "total_images": len(detailed_results),
        "engine_summaries": summaries,
        "detailed_results": detailed_results
    }

    # Save summary report to JSON
    report_path = base_dir / "benchmark_results.json"
    with open(report_path, "w", encoding="utf-8") as f:
        json.dump(report, f, indent=2)

    return report

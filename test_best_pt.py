from pathlib import Path
from ultralytics import YOLO

# =========================================================
# PROJECT ROOT
# =========================================================

BASE_DIR = Path(__file__).resolve().parent

# =========================================================
# PATHS
# =========================================================

MODEL_PATH = BASE_DIR / "models" / "best.pt"
IMAGE_PATH = BASE_DIR / "test_images" / "test.jpg"

# =========================================================
# CHECK FILES
# =========================================================

if not MODEL_PATH.exists():
    raise FileNotFoundError(
        f"Model not found:\n{MODEL_PATH}"
    )

if not IMAGE_PATH.exists():
    raise FileNotFoundError(
        f"Test image not found:\n{IMAGE_PATH}\n\n"
        "Please put a test image inside test_images "
        "and name it test.jpg"
    )

# =========================================================
# LOAD MODEL
# =========================================================

print("=" * 60)
print("LOADING CUSTOM BEST.PT MODEL")
print("=" * 60)

model = YOLO(
    str(MODEL_PATH)
)

print("\nMODEL LOADED SUCCESSFULLY!\n")

# Display trained classes
print("TRAINED CLASSES:")
for class_id, class_name in model.names.items():
    print(
        f"{class_id}: {class_name}"
    )

# =========================================================
# RUN DETECTION
# =========================================================

print("\n")
print("=" * 60)
print("RUNNING OBJECT DETECTION")
print("=" * 60)

results = model.predict(
    source=str(IMAGE_PATH),
    conf=0.25,
    imgsz=960,
    save=True,
    project=str(BASE_DIR / "runs"),
    name="best_pt_test",
    exist_ok=True,
    verbose=True
)

# =========================================================
# READ RESULTS
# =========================================================

result = results[0]

print("\n")
print("=" * 60)
print("DETECTION RESULTS")
print("=" * 60)

if result.boxes is None or len(result.boxes) == 0:

    print("\nNo objects detected.")

else:

    total = len(result.boxes)

    print(
        f"\nTotal detections: {total}\n"
    )

    for i in range(total):

        class_id = int(
            result.boxes.cls[i].item()
        )

        confidence = float(
            result.boxes.conf[i].item()
        )

        x1, y1, x2, y2 = (
            result.boxes.xyxy[i]
            .cpu()
            .numpy()
            .tolist()
        )

        class_name = model.names[
            class_id
        ]

        print(
            f"{i + 1}. "
            f"{class_name} | "
            f"Confidence: {confidence:.2f} | "
            f"Box: "
            f"({x1:.0f}, {y1:.0f}, "
            f"{x2:.0f}, {y2:.0f})"
        )

# =========================================================
# OUTPUT LOCATION
# =========================================================

OUTPUT_DIR = (
    BASE_DIR /
    "runs" /
    "best_pt_test"
)

print("\n")
print("=" * 60)
print("TEST COMPLETED")
print("=" * 60)

print(
    f"\nAnnotated result saved at:\n"
    f"{OUTPUT_DIR}"
)
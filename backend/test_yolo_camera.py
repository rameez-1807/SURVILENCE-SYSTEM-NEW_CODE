import cv2
from pathlib import Path
from ultralytics import YOLO

# Project root
BASE_DIR = Path(__file__).resolve().parent.parent

# YOLO11m model
MODEL_PATH = BASE_DIR / "backend" / "app" / "models" / "yolo11m.pt"

# Check model
if not MODEL_PATH.exists():
    raise FileNotFoundError(
        f"YOLO model not found:\n{MODEL_PATH}"
    )

print("=" * 60)
print("YOLO11m LIVE CAMERA OBJECT DETECTION")
print("=" * 60)

# Load model
print("\nLoading YOLO11m...")
model = YOLO(str(MODEL_PATH))

print("Model loaded successfully!")
print("Starting camera...\n")

# Open laptop webcam
cap = cv2.VideoCapture(0)

if not cap.isOpened():
    raise RuntimeError(
        "Camera open nahi ho rahi. "
        "Check karo ki koi doosra app camera use na kar raha ho."
    )

# Optional camera resolution
cap.set(cv2.CAP_PROP_FRAME_WIDTH, 1280)
cap.set(cv2.CAP_PROP_FRAME_HEIGHT, 720)

print("Camera started.")
print("Press Q to quit.")

while True:

    # Read camera frame
    success, frame = cap.read()

    if not success:
        print("Camera frame read nahi hua.")
        break

    # Run YOLO detection
    results = model.predict(
        source=frame,
        conf=0.35,
        imgsz=640,
        verbose=False
    )

    # Draw boxes + names + confidence
    annotated_frame = results[0].plot()

    # Show live camera
    cv2.imshow(
        "AI Surveillance - YOLO11m Live Detection",
        annotated_frame
    )

    # Press Q to exit
    key = cv2.waitKey(1) & 0xFF

    if key == ord("q"):
        break

# Cleanup
cap.release()
cv2.destroyAllWindows()

print("\nCamera stopped.")
print("Live detection finished.")
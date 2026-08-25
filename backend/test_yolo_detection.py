from pathlib import Path
from ultralytics import YOLO

# Project root
BASE_DIR = Path(__file__).resolve().parent.parent

# YOLO model
MODEL_PATH = BASE_DIR / "backend" / "app" / "models" / "yolo11m.pt"

# Folder containing test images
IMAGE_DIR = BASE_DIR / "test_images"

# Output folder
OUTPUT_DIR = BASE_DIR / "runs" / "detect"

# Check model
if not MODEL_PATH.exists():
    raise FileNotFoundError(
        f"YOLO model not found:\n{MODEL_PATH}"
    )

# Check image folder
if not IMAGE_DIR.exists():
    raise FileNotFoundError(
        f"Test image folder not found:\n{IMAGE_DIR}"
    )

print("=" * 60)
print("YOLO11m OBJECT DETECTION TEST")
print("=" * 60)

# Load model
print("\n1. Loading YOLO11m model...")
model = YOLO(str(MODEL_PATH))

print("   Model loaded successfully!")

# Supported image formats
image_extensions = {
    ".jpg",
    ".jpeg",
    ".png",
    ".webp",
    ".bmp"
}

# Find images
images = [
    file for file in IMAGE_DIR.iterdir()
    if file.is_file()
    and file.suffix.lower() in image_extensions
]

if not images:
    raise FileNotFoundError(
        f"No supported images found in:\n{IMAGE_DIR}"
    )

print(f"\n2. Found {len(images)} test image(s):")

for image in images:
    print(f"   - {image.name}")

# Run detection on all images
print("\n3. Running object detection...\n")

for image_path in images:

    print("-" * 60)
    print(f"Image: {image_path.name}")

    results = model.predict(
        source=str(image_path),
        conf=0.25,
        save=True,
        project=str(OUTPUT_DIR),
        name="yolo11m_test",
        exist_ok=True,
        verbose=False
    )

    found_objects = False

    for result in results:

        if result.boxes is None or len(result.boxes) == 0:
            print("   No objects detected.")
            continue

        for box in result.boxes:

            found_objects = True

            class_id = int(box.cls[0])
            confidence = float(box.conf[0])

            class_name = model.names[class_id]

            print(
                f"   {class_name:<20}"
                f" confidence = {confidence * 100:.2f}%"
            )

    if not found_objects:
        print("   No objects detected.")

print("\n" + "=" * 60)
print("DETECTION TEST COMPLETED")
print("=" * 60)

print(
    f"\nAnnotated output images are saved in:\n"
    f"{OUTPUT_DIR / 'yolo11m_test'}"
)
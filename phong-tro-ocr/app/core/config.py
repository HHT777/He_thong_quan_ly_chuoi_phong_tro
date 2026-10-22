from pathlib import Path


PROJECT_ROOT = Path(__file__).resolve().parents[2]
MODELS_DIR = PROJECT_ROOT / "models"

# Các ngưỡng này được truyền thẳng vào YOLO. Box/digit thấp hơn ngưỡng sẽ bị
# Ultralytics loại bỏ trước khi pipeline xử lý.
REGION_CONFIDENCE_THRESHOLD = 0.5
DIGIT_CONFIDENCE_THRESHOLD = 0.5
CROP_PADDING = 5

REGION_MODEL_PATH = MODELS_DIR / "digit_detection.pt"
DIGIT_MODEL_PATH = MODELS_DIR / "number_detection.pt"

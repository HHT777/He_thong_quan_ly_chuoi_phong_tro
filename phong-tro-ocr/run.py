"""Chạy thử pipeline OCR bằng một file ảnh local, không khởi động API."""

import argparse

from app.core.config import (
    CROP_PADDING,
    DIGIT_CONFIDENCE_THRESHOLD,
    DIGIT_MODEL_PATH,
    REGION_CONFIDENCE_THRESHOLD,
    REGION_MODEL_PATH,
)
from app.services.digit_pipeline import DigitPipeline


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Đọc chỉ số từ một ảnh công tơ.")
    parser.add_argument("image", help="Đường dẫn ảnh cần nhận dạng")
    args = parser.parse_args()
    pipeline = DigitPipeline(
        region_model_path=REGION_MODEL_PATH,
        digit_model_path=DIGIT_MODEL_PATH,
        conf_region=REGION_CONFIDENCE_THRESHOLD,
        conf_digit=DIGIT_CONFIDENCE_THRESHOLD,
        padding=CROP_PADDING,
    )
    print(pipeline.run_file(args.image))

from pathlib import Path

import cv2
import numpy as np
from ultralytics import YOLO


class OcrPipelineError(Exception):
    """Lỗi nghiệp vụ có thể trả về cho client API."""

    def __init__(self, code: str) -> None:
        self.code = code
        super().__init__(code)


class DigitPipeline:
    """Tìm vùng hiển thị số công tơ rồi nhận diện các chữ số bên trong."""

    def __init__(
        self,
        region_model_path: str | Path,
        digit_model_path: str | Path,
        conf_region: float = 0.5,
        conf_digit: float = 0.5,
        padding: int = 5,
    ) -> None:
        self.region_model = YOLO(str(region_model_path))
        self.digit_model = YOLO(str(digit_model_path))
        self.conf_region = conf_region
        self.conf_digit = conf_digit
        self.padding = padding

    def _find_best_region(self, image: np.ndarray) -> tuple[int, int, int, int]:
        """Trả về box có confidence cao nhất sau khi YOLO đã lọc theo ngưỡng."""
        result = self.region_model.predict(
            image, conf=self.conf_region, verbose=False
        )[0]
        if result.boxes is None or len(result.boxes) == 0:
            raise OcrPipelineError("METER_DISPLAY_NOT_FOUND")

        best_box = max(result.boxes, key=lambda box: float(box.conf[0]))
        return tuple(map(int, best_box.xyxy[0].tolist()))

    def _crop_with_padding(
        self, image: np.ndarray, box: tuple[int, int, int, int]
    ) -> np.ndarray:
        height, width = image.shape[:2]
        x1, y1, x2, y2 = box
        x1 = max(0, x1 - self.padding)
        y1 = max(0, y1 - self.padding)
        x2 = min(width, x2 + self.padding)
        y2 = min(height, y2 + self.padding)

        cropped = image[y1:y2, x1:x2]
        if cropped.size == 0:
            raise OcrPipelineError("METER_DISPLAY_NOT_FOUND")
        return cropped

    def _read_digits(self, cropped_region: np.ndarray) -> str:
        """Nhận diện digit và ghép chúng theo thứ tự từ trái sang phải."""
        result = self.digit_model.predict(
            cropped_region, conf=self.conf_digit, verbose=False
        )[0]
        if result.boxes is None or len(result.boxes) == 0:
            raise OcrPipelineError("OCR_FAILED")

        detected_digits: list[tuple[float, str]] = []
        for box in result.boxes:
            x1, _, x2, _ = box.xyxy[0].tolist()
            class_id = int(box.cls[0])
            label = str(self.digit_model.names[class_id])
            detected_digits.append(((x1 + x2) / 2, label))

        detected_digits.sort(key=lambda digit: digit[0])
        ocr_value = "".join(label for _, label in detected_digits)
        if not ocr_value:
            raise OcrPipelineError("OCR_FAILED")
        return ocr_value

    def run_image(self, image: np.ndarray) -> str:
        """Chạy OCR trên một ảnh OpenCV BGR và trả về dãy số dạng chuỗi."""
        if image is None or image.size == 0:
            raise OcrPipelineError("INVALID_IMAGE")
        region_box = self._find_best_region(image)
        return self._read_digits(self._crop_with_padding(image, region_box))

    def run_file(self, image_path: str | Path) -> str:
        """Tiện ích cho việc chạy thử pipeline trực tiếp bằng file ảnh local."""
        image = cv2.imread(str(image_path))
        if image is None:
            raise FileNotFoundError(f"Không đọc được ảnh: {image_path}")
        return self.run_image(image)

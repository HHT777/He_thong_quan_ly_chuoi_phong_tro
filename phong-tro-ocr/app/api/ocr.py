import cv2
import numpy as np
from fastapi import APIRouter, File, HTTPException, Request, UploadFile

from app.services.digit_pipeline import DigitPipeline, OcrPipelineError


router = APIRouter(tags=["OCR"])


@router.post("/ocr")
async def recognize_meter_digits(
    request: Request,
    file: UploadFile = File(...),
) -> dict[str, str | bool | None]:
    """Nhận một ảnh công tơ và trả về dãy số OCR dưới dạng chuỗi."""
    if file.content_type and not file.content_type.startswith("image/"):
        raise HTTPException(status_code=415, detail="File upload phải là ảnh.")

    raw_image = await file.read()
    if not raw_image:
        raise HTTPException(status_code=400, detail="File ảnh đang rỗng.")

    image = cv2.imdecode(np.frombuffer(raw_image, dtype=np.uint8), cv2.IMREAD_COLOR)
    if image is None:
        raise HTTPException(status_code=400, detail="Không thể đọc nội dung ảnh.")

    pipeline: DigitPipeline = request.app.state.pipeline
    try:
        ocr_value = pipeline.run_image(image)
    except OcrPipelineError as error:
        return {
            "success": False,
            "ocr_value": None,
            "error_code": error.code,
        }

    return {"success": True, "ocr_value": ocr_value, "error_code": None}

from contextlib import asynccontextmanager

from fastapi import FastAPI

from app.api.ocr import router as ocr_router
from app.core.config import (
    CROP_PADDING,
    DIGIT_CONFIDENCE_THRESHOLD,
    DIGIT_MODEL_PATH,
    REGION_CONFIDENCE_THRESHOLD,
    REGION_MODEL_PATH,
)
from app.services.digit_pipeline import DigitPipeline


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Nạp hai model duy nhất một lần khi API khởi động."""
    app.state.pipeline = DigitPipeline(
        region_model_path=REGION_MODEL_PATH,
        digit_model_path=DIGIT_MODEL_PATH,
        conf_region=REGION_CONFIDENCE_THRESHOLD,
        conf_digit=DIGIT_CONFIDENCE_THRESHOLD,
        padding=CROP_PADDING,
    )
    yield


app = FastAPI(
    title="Electric Meter OCR API",
    version="1.0.0",
    lifespan=lifespan,
)
app.include_router(ocr_router)


@app.get("/health", tags=["Health"])
async def health_check() -> dict[str, bool]:
    return {"success": True}

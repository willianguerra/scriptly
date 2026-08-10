from fastapi import APIRouter, Request

from app.automation.flow.models import (
    GenerateVideoRequest,
    GenerateVideoResponse,
)

router = APIRouter(prefix="/debug", tags=["debug"])


@router.post("/generate-video", response_model=GenerateVideoResponse)
async def generate_video(
    payload: GenerateVideoRequest,
    request: Request,
) -> GenerateVideoResponse:
    return await request.app.state.flow_provider.generate_video(payload.prompt)


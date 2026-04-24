from fastapi import APIRouter
from ..models.schemas import SupervisorRequest
from ..services import supervisor_service

router = APIRouter()

@router.post("/analyze")
async def supervisor_analyze(req: SupervisorRequest):
    return supervisor_service.analyze(req.inventory, req.context)

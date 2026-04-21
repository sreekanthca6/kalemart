from fastapi import APIRouter
from ..models.schemas import InsightRequest, ReorderRequest, ComboRequest
from ..services import claude_service

router = APIRouter()

@router.post("/")
async def get_insight(req: InsightRequest):
    insight = claude_service.ask(req.context, req.question)
    return {"insight": insight}

@router.post("/reorder")
async def reorder_suggestions(req: ReorderRequest):
    suggestions = claude_service.reorder_suggestions(req.items)
    return {"suggestions": suggestions, "item_count": len(req.items)}

@router.post("/combos")
async def combo_recommendations(req: ComboRequest):
    recommendations = claude_service.combo_recommendations(req.productIds)
    return {"recommendations": recommendations}

@router.get("/reorder-suggestions")
async def reorder_suggestions_stub():
    return {"message": "POST /api/insights/reorder with {items:[]} for AI-powered suggestions"}

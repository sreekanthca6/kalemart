from fastapi import APIRouter
from pydantic import BaseModel
import anthropic
import os

router = APIRouter()
client = anthropic.Anthropic(api_key=os.getenv("ANTHROPIC_API_KEY", ""))

class InsightRequest(BaseModel):
    context: str
    question: str

@router.post("/")
async def get_insight(req: InsightRequest):
    message = client.messages.create(
        model="claude-sonnet-4-6",
        max_tokens=1024,
        messages=[{
            "role": "user",
            "content": f"Kalemart inventory context:\n{req.context}\n\nQuestion: {req.question}"
        }]
    )
    return {"insight": message.content[0].text}

@router.get("/reorder-suggestions")
async def reorder_suggestions():
    # TODO: pull low-stock items and ask Claude for reorder recommendations
    return {"suggestions": [], "message": "reorder suggestions stub"}

from pydantic import BaseModel
from typing import Any

class InsightRequest(BaseModel):
    context: str
    question: str

class ReorderRequest(BaseModel):
    items: list[dict[str, Any]]

class ComboRequest(BaseModel):
    productIds: list[str]

class SupervisorRequest(BaseModel):
    inventory: list[dict[str, Any]]
    context: dict[str, Any] = {}

from __future__ import annotations

from typing import List, Literal, Optional

from pydantic import BaseModel, Field


class CreateTableResponse(BaseModel):
    code: str


class CreateTableRequest(BaseModel):
    code: Optional[str] = Field(
        default=None,
        min_length=4,
        max_length=16,
        description="Code optionnel. Si non fourni, le serveur en génère un.",
    )


class JoinTableRequest(BaseModel):
    code: str = Field(min_length=4, max_length=16)
    nickname: str = Field(min_length=1, max_length=32)


class JoinTableResponse(BaseModel):
    tableCode: str
    clientToken: str
    nickname: str


class OrderItem(BaseModel):
    name: str = Field(min_length=1, max_length=200)
    quantity: int = Field(ge=0, le=1000)


class SubmitOrderRequest(BaseModel):
    # Hard limits to reduce payload abuse.
    items: List[OrderItem] = Field(min_length=1, max_length=50)


class AggregatedItem(BaseModel):
    name: str
    quantity: int


class ClientSummary(BaseModel):
    nickname: str
    items: List[AggregatedItem]


class TableSummaryResponse(BaseModel):
    type: Literal["summary"] = "summary"
    tableCode: str
    items: List[AggregatedItem]
    clients: List[ClientSummary]


class ErrorResponse(BaseModel):
    detail: str


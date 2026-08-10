from typing import Literal

from pydantic import BaseModel


class BrowserStatus(BaseModel):
    running: bool
    profile: str


class BrowserOpenedResponse(BaseModel):
    status: Literal["opened"] = "opened"


class BrowserClosedResponse(BaseModel):
    status: Literal["closed"] = "closed"


class FlowOpenedResponse(BaseModel):
    status: Literal["opened"] = "opened"

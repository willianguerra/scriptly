from dataclasses import dataclass, field
from datetime import UTC, datetime
from enum import StrEnum
from typing import Literal

from pydantic import BaseModel, Field, field_validator


class GenerationState(StrEnum):
    PREPARING = "PREPARING"
    SUBMITTING = "SUBMITTING"
    GENERATING = "GENERATING"
    DOWNLOADING = "DOWNLOADING"
    COMPLETED = "COMPLETED"
    FAILED = "FAILED"
    REJECTED = "REJECTED"
    TIMEOUT = "TIMEOUT"
    AUTH_REQUIRED = "AUTH_REQUIRED"


TERMINAL_STATES = {
    GenerationState.COMPLETED,
    GenerationState.FAILED,
    GenerationState.REJECTED,
    GenerationState.TIMEOUT,
    GenerationState.AUTH_REQUIRED,
}

ALLOWED_TRANSITIONS = {
    GenerationState.PREPARING: {
        GenerationState.SUBMITTING,
        GenerationState.FAILED,
        GenerationState.REJECTED,
        GenerationState.TIMEOUT,
        GenerationState.AUTH_REQUIRED,
    },
    GenerationState.SUBMITTING: {
        GenerationState.GENERATING,
        GenerationState.FAILED,
        GenerationState.REJECTED,
        GenerationState.TIMEOUT,
        GenerationState.AUTH_REQUIRED,
    },
    GenerationState.GENERATING: {
        GenerationState.DOWNLOADING,
        GenerationState.FAILED,
        GenerationState.REJECTED,
        GenerationState.TIMEOUT,
        GenerationState.AUTH_REQUIRED,
    },
    GenerationState.DOWNLOADING: {
        GenerationState.COMPLETED,
        GenerationState.FAILED,
        GenerationState.TIMEOUT,
        GenerationState.AUTH_REQUIRED,
    },
}


@dataclass(frozen=True)
class StateEvent:
    state: GenerationState
    recorded_at: str = field(
        default_factory=lambda: datetime.now(UTC).isoformat(timespec="milliseconds")
    )


@dataclass
class GenerationExecution:
    state: GenerationState = GenerationState.PREPARING
    history: list[StateEvent] = field(
        default_factory=lambda: [StateEvent(GenerationState.PREPARING)]
    )

    def transition(self, next_state: GenerationState) -> None:
        allowed = ALLOWED_TRANSITIONS.get(self.state, set())
        if next_state not in allowed:
            raise ValueError(
                f"invalid generation state transition: {self.state} -> {next_state}"
            )
        self.state = next_state
        self.history.append(StateEvent(next_state))


class GenerateVideoRequest(BaseModel):
    prompt: str = Field(min_length=1, max_length=4_000)

    @field_validator("prompt")
    @classmethod
    def normalize_prompt(cls, value: str) -> str:
        normalized = value.strip()
        if not normalized:
            raise ValueError("prompt must not be blank")
        return normalized


class GenerateVideoCompleted(BaseModel):
    status: Literal["completed"] = "completed"
    file: str
    duration_seconds: float = Field(ge=0)


class GenerateVideoFailed(BaseModel):
    status: Literal["failed"] = "failed"
    error_code: str
    error_message: str


GenerateVideoResponse = GenerateVideoCompleted | GenerateVideoFailed


import pytest

from app.automation.flow.models import GenerationExecution, GenerationState


def test_generation_execution_records_valid_state_history() -> None:
    execution = GenerationExecution()

    execution.transition(GenerationState.SUBMITTING)
    execution.transition(GenerationState.GENERATING)
    execution.transition(GenerationState.DOWNLOADING)
    execution.transition(GenerationState.COMPLETED)

    assert execution.state is GenerationState.COMPLETED
    assert [item.state for item in execution.history] == [
        GenerationState.PREPARING,
        GenerationState.SUBMITTING,
        GenerationState.GENERATING,
        GenerationState.DOWNLOADING,
        GenerationState.COMPLETED,
    ]


def test_generation_execution_rejects_invalid_transition() -> None:
    execution = GenerationExecution()

    with pytest.raises(ValueError, match="invalid generation state transition"):
        execution.transition(GenerationState.COMPLETED)


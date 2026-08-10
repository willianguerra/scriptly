from fastapi.testclient import TestClient

def test_status_reports_foundation_as_ready_without_browser(
    client: TestClient,
) -> None:
    response = client.get("/status")

    assert response.status_code == 200
    assert response.json() == {
        "agent": "ready",
        "browser": "stopped",
        "flow": "unknown",
    }

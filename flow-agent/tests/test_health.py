from fastapi.testclient import TestClient

def test_health_returns_service_identity(client: TestClient) -> None:
    response = client.get("/health")

    assert response.status_code == 200
    assert response.json() == {
        "status": "ok",
        "service": "scriptly-flow-agent",
        "version": "0.3.0",
    }

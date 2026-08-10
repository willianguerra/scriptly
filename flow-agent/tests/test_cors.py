from fastapi.testclient import TestClient

def test_cors_allows_the_configured_local_scriptly_origin(
    client: TestClient,
) -> None:
    response = client.options(
        "/health",
        headers={
            "Origin": "http://localhost:3000",
            "Access-Control-Request-Method": "GET",
        },
    )

    assert response.status_code == 200
    assert response.headers["access-control-allow-origin"] == "http://localhost:3000"


def test_cors_does_not_allow_an_unconfigured_origin(client: TestClient) -> None:
    response = client.options(
        "/health",
        headers={
            "Origin": "https://example.com",
            "Access-Control-Request-Method": "GET",
        },
    )

    assert "access-control-allow-origin" not in response.headers


def test_cors_allows_post_for_the_configured_scriptly_origin(
    client: TestClient,
) -> None:
    response = client.options(
        "/browser/open",
        headers={
            "Origin": "http://localhost:3000",
            "Access-Control-Request-Method": "POST",
        },
    )

    assert response.status_code == 200
    assert response.headers["access-control-allow-origin"] == "http://localhost:3000"


def test_mutating_request_rejects_an_unconfigured_browser_origin(
    client: TestClient,
) -> None:
    response = client.post(
        "/browser/open",
        headers={"Origin": "https://example.com"},
    )

    assert response.status_code == 403
    assert response.json()["detail"]["code"] == "ORIGIN_NOT_ALLOWED"

from __future__ import annotations

from fastapi.testclient import TestClient
from starlette.requests import Request

from rip.app import _client_ip, create_app
from tests.support import build_settings, fake_extractor


def test_health() -> None:
    with TestClient(create_app(build_settings(), extractor=fake_extractor)) as client:
        response = client.get("/health")
        assert response.status_code == 200
        assert response.json() == {"status": "ok"}


def test_downloads_initially_empty() -> None:
    with TestClient(create_app(build_settings(), extractor=fake_extractor)) as client:
        response = client.get("/api/downloads")
        assert response.status_code == 200
        assert response.json() == {"downloads": []}


def test_invalid_extract_json() -> None:
    with TestClient(create_app(build_settings(), extractor=fake_extractor)) as client:
        response = client.post("/api/extract", content="{", headers={"content-type": "application/json"})
        assert response.status_code == 400
        assert response.json()["error"] == "Invalid JSON body."


def test_invalid_extract_url() -> None:
    with TestClient(create_app(build_settings(), extractor=fake_extractor)) as client:
        response = client.post("/api/extract", json={"url": "not-a-url"})
        assert response.status_code == 400
        assert response.json()["error"] == "Invalid URL."


def test_invalid_download_payload() -> None:
    with TestClient(create_app(build_settings(), extractor=fake_extractor)) as client:
        response = client.post("/api/download", json={})
        assert response.status_code == 400
        assert response.json()["error"] == "Invalid download request."


def test_oversized_body_rejected() -> None:
    with TestClient(create_app(build_settings(), extractor=fake_extractor)) as client:
        oversized = "x" * (1024 * 1024 + 1)
        body = {"url": "https://example.com", "formatId": oversized, "title": "x"}
        response = client.post("/api/download", json=body)
        assert response.status_code == 413
        assert response.json()["error"] == "Request body too large."


def test_chunked_body_without_content_length_is_rejected() -> None:
    with TestClient(create_app(build_settings(request_body_limit_bytes=64), extractor=fake_extractor)) as client:
        chunks = [
            b'{"url":"https://example.com","formatId":"',
            b"x" * 128,
            b'","title":"x"}',
        ]
        response = client.post("/api/download", content=iter(chunks), headers={"content-type": "application/json"})
        assert response.status_code == 413
        assert response.json()["error"] == "Request body too large."


def test_cancel_missing_download() -> None:
    with TestClient(create_app(build_settings(), extractor=fake_extractor)) as client:
        response = client.delete("/api/download/missing")
        assert response.status_code == 404
        assert response.json()["error"] == "Download not found."


def test_clear_completed() -> None:
    with TestClient(create_app(build_settings(), extractor=fake_extractor)) as client:
        response = client.delete("/api/downloads/completed")
        assert response.status_code == 200
        assert response.json() == {"status": "ok"}


def test_client_ip_ignores_untrusted_forwarded_for() -> None:
    request = _build_request(headers=[(b"x-forwarded-for", b"203.0.113.10")], client=("10.0.0.5", 1234))
    assert _client_ip(request, {"127.0.0.1"}) == "10.0.0.5"


def test_client_ip_uses_forwarded_for_from_trusted_proxy() -> None:
    request = _build_request(headers=[(b"x-forwarded-for", b"203.0.113.10, 10.0.0.5")], client=("10.0.0.5", 1234))
    assert _client_ip(request, {"10.0.0.5"}) == "203.0.113.10"


def _build_request(*, headers: list[tuple[bytes, bytes]], client: tuple[str, int]) -> Request:
    scope = {
        "type": "http",
        "asgi": {"version": "3.0"},
        "http_version": "1.1",
        "method": "GET",
        "scheme": "http",
        "path": "/",
        "raw_path": b"/",
        "query_string": b"",
        "headers": headers,
        "client": client,
        "server": ("127.0.0.1", 3000),
    }

    async def receive() -> dict:
        return {"type": "http.request", "body": b"", "more_body": False}

    return Request(scope, receive)

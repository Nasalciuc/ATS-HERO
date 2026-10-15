"""The Lambda entry point serves the same FastAPI app (API Gateway HTTP API, payload v2)."""
import base64
import json

import pytest

mangum = pytest.importorskip("mangum")  # only the Lambda image installs it

from app.lambda_handler import handler  # noqa: E402


def _event(method: str, path: str, body: bytes | None = None, content_type: str = "application/json") -> dict:
    return {
        "version": "2.0",
        "routeKey": f"{method} {path}",
        "rawPath": path,
        "rawQueryString": "",
        "headers": {"content-type": content_type},
        "requestContext": {
            "http": {"method": method, "path": path, "sourceIp": "203.0.113.7", "protocol": "HTTP/1.1", "userAgent": "pytest"},
            "requestId": "test",
            "stage": "$default",
        },
        "body": base64.b64encode(body).decode() if body is not None else None,
        "isBase64Encoded": body is not None,
    }


class _Context:
    aws_request_id = "test"


def test_health():
    res = handler(_event("GET", "/health"), _Context())
    assert res["statusCode"] == 200
    assert json.loads(res["body"])["status"] == "ok"


def test_score():
    body = json.dumps({"text": "Jane Doe\njane@example.com\nSenior Engineer\nLed a team of 5, cut costs by 20%."}).encode()
    res = handler(_event("POST", "/score", body), _Context())
    assert res["statusCode"] == 200
    assert "overall_score" in json.loads(res["body"])

"""Per-user limit on Lambda: one counter per Clerk user and minute, shared through DynamoDB."""
import base64
import json

import pytest

pytest.importorskip("mangum")  # only the Lambda image installs it
moto = pytest.importorskip("moto")  # dev-only: pip install "moto[dynamodb]"
boto3 = pytest.importorskip("boto3")

TABLE = "atshero-test-ratelimit"
CV = json.dumps({"text": "Jane Doe\njane@example.com\nSenior Engineer\nLed a team of 5, cut costs by 20%."}).encode()


def _event(method: str, path: str, sub: str | None = None, body: bytes | None = None) -> dict:
    context = {
        "http": {"method": method, "path": path, "sourceIp": "203.0.113.7", "protocol": "HTTP/1.1", "userAgent": "pytest"},
        "requestId": "test",
        "stage": "$default",
    }
    if sub:  # what the HTTP API JWT authorizer adds after it verified the Clerk token
        context["authorizer"] = {"jwt": {"claims": {"sub": sub, "aud": "atshero-api"}, "scopes": None}}
    return {
        "version": "2.0",
        "routeKey": f"{method} {path}",
        "rawPath": path,
        "rawQueryString": "",
        "headers": {"content-type": "application/json"},
        "requestContext": context,
        "body": base64.b64encode(body).decode() if body is not None else None,
        "isBase64Encoded": body is not None,
    }


class _Context:
    aws_request_id = "test"


@pytest.fixture()
def limited(monkeypatch):
    # dummy values: moto intercepts every call, nothing leaves the machine
    monkeypatch.setenv("AWS_DEFAULT_REGION", "us-east-1")
    monkeypatch.setenv("AWS_ACCESS_KEY_ID", "testing")
    monkeypatch.setenv("AWS_SECRET_ACCESS_KEY", "testing")
    monkeypatch.setenv("RATE_LIMIT_TABLE", TABLE)
    monkeypatch.setenv("TIER2_LIMIT_PER_MINUTE", "3")
    with moto.mock_aws():
        ddb = boto3.client("dynamodb")
        ddb.create_table(
            TableName=TABLE,
            BillingMode="PAY_PER_REQUEST",
            AttributeDefinitions=[{"AttributeName": "pk", "AttributeType": "S"}],
            KeySchema=[{"AttributeName": "pk", "KeyType": "HASH"}],
        )
        from app import rate_limit

        monkeypatch.setattr(rate_limit, "_client", None)
        monkeypatch.setattr(rate_limit, "_now", lambda: 1_000_000_040.0)  # 20 s into a minute
        from app.lambda_handler import handler

        yield handler, ddb, rate_limit


def test_fourth_post_in_a_minute_gets_429_and_other_users_are_untouched(limited):
    handler, _, _ = limited
    codes = [handler(_event("POST", "/score", "user_a", CV), _Context())["statusCode"] for _ in range(4)]
    assert codes == [200, 200, 200, 429]
    blocked = handler(_event("POST", "/score", "user_a", CV), _Context())
    assert blocked["statusCode"] == 429
    assert blocked["headers"]["retry-after"] == "40"  # seconds left in the pinned minute
    assert handler(_event("POST", "/score", "user_b", CV), _Context())["statusCode"] == 200


def test_health_is_not_counted(limited):
    handler, ddb, _ = limited
    for _ in range(5):
        assert handler(_event("GET", "/health"), _Context())["statusCode"] == 200
    assert ddb.scan(TableName=TABLE)["Count"] == 0


def test_a_new_minute_starts_a_new_counter_and_ttl_is_set(limited):
    _, ddb, rate_limit = limited
    assert [rate_limit.count("tier2#u", now=120 + i) for i in range(4)] == [1, 2, 3, 4]
    assert rate_limit.count("tier2#u", now=180) == 1  # next minute, new key
    item = ddb.get_item(TableName=TABLE, Key={"pk": {"S": "tier2#u#2"}})["Item"]
    assert item["count"]["N"] == "4"
    assert item["expiresAt"]["N"] == str(4 * 60)  # end of the following minute; TTL only cleans up


def test_without_a_table_the_limiter_is_off(limited, monkeypatch):
    handler, ddb, _ = limited
    monkeypatch.delenv("RATE_LIMIT_TABLE")
    for _ in range(5):
        assert handler(_event("POST", "/score", "user_a", CV), _Context())["statusCode"] == 200
    assert ddb.scan(TableName=TABLE)["Count"] == 0


def test_a_limiter_outage_lets_requests_through(limited, monkeypatch):
    handler, _, rate_limit = limited

    def broken(*_args, **_kwargs):
        raise RuntimeError("DynamoDB unavailable")

    monkeypatch.setattr(rate_limit, "count", broken)
    assert handler(_event("POST", "/score", "user_a", CV), _Context())["statusCode"] == 200

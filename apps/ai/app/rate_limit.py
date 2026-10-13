"""Per-user limit for the Tier 2 API on Lambda, shared by every instance through DynamoDB.

API Gateway has already verified the Clerk token, so the user id comes from the authorizer context
of the Lambda event (Mangum puts the event in scope["aws.event"]), never from the request itself.
Fixed one-minute window: the key carries the minute number, so every minute starts a new counter.
TTL only deletes old keys (it can lag by days); it never resets a counter.
Without RATE_LIMIT_TABLE (local uvicorn, tests) the limiter is off and slowapi stays the only limit.
"""
from __future__ import annotations

import logging
import os
import time

from starlette.responses import JSONResponse

log = logging.getLogger(__name__)

WINDOW_SECONDS = 60
_client = None


def _table() -> str:
    return os.environ.get("RATE_LIMIT_TABLE", "")


def _limit() -> int:
    return int(os.environ.get("TIER2_LIMIT_PER_MINUTE", "30"))


def _now() -> float:
    return time.time()  # one place to read the clock (tests pin it)


def _dynamodb():
    global _client
    if _client is None:
        import boto3  # part of the Lambda base image

        _client = boto3.client("dynamodb")
    return _client


def user_id(scope: dict) -> str | None:
    """The Clerk user id (JWT "sub") that API Gateway verified, or None."""
    event = scope.get("aws.event") or {}
    jwt = ((event.get("requestContext") or {}).get("authorizer") or {}).get("jwt") or {}
    return (jwt.get("claims") or {}).get("sub")


def count(key: str, now: float | None = None) -> int:
    """Add one request to the current minute of `key` and return that minute's total."""
    window = int(_now() if now is None else now) // WINDOW_SECONDS
    out = _dynamodb().update_item(
        TableName=_table(),
        Key={"pk": {"S": f"{key}#{window}"}},
        UpdateExpression="ADD #n :one SET expiresAt = if_not_exists(expiresAt, :exp)",
        ExpressionAttributeNames={"#n": "count"},  # "count" is a DynamoDB reserved word
        ExpressionAttributeValues={
            ":one": {"N": "1"},
            ":exp": {"N": str((window + 2) * WINDOW_SECONDS)},
        },
        ReturnValues="UPDATED_NEW",
    )
    return int(out["Attributes"]["count"]["N"])


class PerUserLimit:
    """ASGI wrapper: 429 once a signed-in user sends more than TIER2_LIMIT_PER_MINUTE POSTs.

    The DynamoDB call is synchronous on purpose: a Lambda instance serves one request at a time.
    """

    def __init__(self, app):
        self.app = app

    async def __call__(self, scope, receive, send):
        if scope["type"] == "http" and scope.get("method") == "POST" and _table():
            sub = user_id(scope)
            if sub:
                try:
                    over = count(f"tier2#{sub}") > _limit()
                except Exception:  # an outage of the limiter must not take the API down
                    log.exception("rate limit check failed; request allowed")
                    over = False
                if over:
                    retry = WINDOW_SECONDS - int(_now()) % WINDOW_SECONDS
                    response = JSONResponse(
                        {"detail": "Too many requests. Try again in a minute."},
                        status_code=429,
                        headers={"Retry-After": str(retry)},
                    )
                    await response(scope, receive, send)
                    return
        await self.app(scope, receive, send)

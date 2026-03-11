from __future__ import annotations

import time
from collections import defaultdict, deque


class RateLimiter:
    def __init__(self, limit: int, window_seconds: int) -> None:
        self.limit = limit
        self.window_seconds = window_seconds
        self._events: dict[str, deque[float]] = defaultdict(deque)
        self._next_prune_at = 0.0

    def allow(self, key: str) -> bool:
        now = time.monotonic()
        if now >= self._next_prune_at:
            self._prune(now)
            self._next_prune_at = now + self.window_seconds

        bucket = self._events[key]
        self._trim_bucket(bucket, now)
        if not bucket:
            self._events.pop(key, None)
            bucket = self._events[key]
        if len(bucket) >= self.limit:
            return False
        bucket.append(now)
        return True

    def _prune(self, now: float) -> None:
        for key in list(self._events):
            bucket = self._events.get(key)
            if bucket is None:
                continue
            self._trim_bucket(bucket, now)
            if not bucket:
                self._events.pop(key, None)

    def _trim_bucket(self, bucket: deque[float], now: float) -> None:
        threshold = now - self.window_seconds
        while bucket and bucket[0] < threshold:
            bucket.popleft()

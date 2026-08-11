"""Metrics registry and LLM cache tests. No FastAPI, no network."""

from __future__ import annotations

import os
import sys
import time
import unittest

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))

from backend import metrics  # noqa: E402
from backend.llm import _TTLCache  # noqa: E402


class TestMetrics(unittest.TestCase):
    def setUp(self):
        metrics.reset()

    def tearDown(self):
        metrics.reset()

    def test_counters_accumulate(self):
        metrics.incr("sakhi_http_requests_total", route="/chat", status="200")
        metrics.incr("sakhi_http_requests_total", route="/chat", status="200")
        metrics.incr("sakhi_http_requests_total", route="/chat", status="500")
        text = metrics.render_prometheus()
        self.assertIn("sakhi_http_requests_total", text)
        self.assertIn("2", text)

    def test_labels_are_kept_separate(self):
        metrics.incr("sakhi_auth_failures_total", reason="bad_password")
        metrics.incr("sakhi_auth_failures_total", reason="expired_token")
        data = metrics.snapshot()
        self.assertEqual(len(data["counters"]), 2)

    def test_histogram_reports_percentiles(self):
        for value in range(1, 101):
            metrics.observe("sakhi_chat_latency_ms", float(value))
        data = metrics.snapshot()
        histogram = next(iter(data["latency"].values()))
        self.assertEqual(histogram["count"], 100)
        self.assertGreaterEqual(histogram["p95"], histogram["p50"])

    def test_prometheus_output_is_well_formed(self):
        metrics.incr("sakhi_chat_messages_total")
        metrics.observe("sakhi_chat_latency_ms", 12.5)
        for line in metrics.render_prometheus().splitlines():
            if not line or line.startswith("#"):
                continue
            self.assertRegex(line, r"^[a-zA-Z_:][a-zA-Z0-9_:]*(\{.*\})? -?[0-9.eE+]+$")

    def test_reset_clears_everything(self):
        metrics.incr("sakhi_chat_messages_total")
        metrics.reset()
        data = metrics.snapshot()
        self.assertEqual(data["counters"], {})


class TestTTLCache(unittest.TestCase):
    def test_hit_and_miss(self):
        cache = _TTLCache(max_entries=4, ttl_seconds=60)
        self.assertIsNone(cache.get("a"))
        cache.set("a", "answer")
        self.assertEqual(cache.get("a"), "answer")

    def test_entries_expire(self):
        cache = _TTLCache(max_entries=4, ttl_seconds=60)
        cache.set("a", "answer")
        # Force the stored entry to look stale rather than sleeping for a minute.
        expires_at, value = cache._data["a"]
        cache._data["a"] = (time.time() - 1, value)
        self.assertLess(expires_at, time.time() + 61)
        self.assertIsNone(cache.get("a"), "expired entry must not be served")

    def test_capacity_is_bounded(self):
        cache = _TTLCache(max_entries=3, ttl_seconds=60)
        for index in range(10):
            cache.set(f"key{index}", index)
        self.assertLessEqual(len(cache._data), 3)
        self.assertEqual(cache.get("key9"), 9, "most recent entry must survive eviction")

    def test_disabled_cache_never_stores(self):
        cache = _TTLCache(max_entries=0, ttl_seconds=60)
        cache.set("a", 1)
        self.assertIsNone(cache.get("a"))

    def test_clear_empties_the_cache(self):
        cache = _TTLCache(max_entries=4, ttl_seconds=60)
        cache.set("a", 1)
        cache.clear()
        self.assertIsNone(cache.get("a"))


if __name__ == "__main__":
    unittest.main()

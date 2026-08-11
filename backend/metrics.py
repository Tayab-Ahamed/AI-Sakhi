"""Prometheus-compatible metrics without adding a dependency.

Exposes counters that matter for an AI product: request volume and latency by
route class, LLM tokens/latency/failures, retrieval hit rate, and safety events.
"""
from __future__ import annotations

import threading
import time
from collections import defaultdict

_lock = threading.Lock()
_counters: dict[str, float] = defaultdict(float)
_histograms: dict[str, list[float]] = defaultdict(list)
_started_at = time.time()

_MAX_SAMPLES = 2000


def incr(name: str, value: float = 1.0, **labels: str) -> None:
    key = _key(name, labels)
    with _lock:
        _counters[key] += value


def observe(name: str, value: float, **labels: str) -> None:
    key = _key(name, labels)
    with _lock:
        samples = _histograms[key]
        samples.append(value)
        if len(samples) > _MAX_SAMPLES:
            del samples[: len(samples) - _MAX_SAMPLES]


def _key(name: str, labels: dict[str, str]) -> str:
    if not labels:
        return name
    rendered = ",".join(f'{k}="{_escape(v)}"' for k, v in sorted(labels.items()))
    return f"{name}{{{rendered}}}"


def _escape(value: str) -> str:
    return str(value).replace("\\", "\\\\").replace('"', '\\"').replace("\n", " ")


def _percentile(sorted_values: list[float], pct: float) -> float:
    if not sorted_values:
        return 0.0
    index = min(len(sorted_values) - 1, max(0, int(round((pct / 100.0) * len(sorted_values)) - 1)))
    return sorted_values[index]


def snapshot() -> dict:
    """JSON-friendly view of all metrics (used by /metrics.json and tests)."""
    with _lock:
        counters = dict(_counters)
        histograms = {key: sorted(values) for key, values in _histograms.items()}
    summary = {}
    for key, values in histograms.items():
        summary[key] = {
            "count": len(values),
            "avg": round(sum(values) / len(values), 2) if values else 0.0,
            "p50": round(_percentile(values, 50), 2),
            "p95": round(_percentile(values, 95), 2),
            "p99": round(_percentile(values, 99), 2),
        }
    return {
        "uptime_seconds": round(time.time() - _started_at, 1),
        "counters": counters,
        "latency": summary,
    }


def render_prometheus() -> str:
    """Render the current metrics in Prometheus text exposition format."""
    from backend.llm import STATS as LLM_STATS

    lines: list[str] = [
        "# HELP sakhi_uptime_seconds Process uptime in seconds.",
        "# TYPE sakhi_uptime_seconds gauge",
        f"sakhi_uptime_seconds {round(time.time() - _started_at, 1)}",
    ]

    with _lock:
        counters = dict(_counters)
        histograms = {key: sorted(values) for key, values in _histograms.items()}

    for name, value in sorted(counters.items()):
        lines.append(f"{name} {value}")

    for name, values in sorted(histograms.items()):
        base = name.split("{")[0]
        suffix = name[len(base):]
        lines.append(f"{base}_count{suffix} {len(values)}")
        lines.append(f"{base}_sum{suffix} {round(sum(values), 2)}")
        for pct in (50, 95, 99):
            quantile = f'quantile="0.{pct}"'
            inner = f"{suffix[1:-1]},{quantile}" if suffix else quantile
            lines.append(f"{base}{{{inner}}} {round(_percentile(values, pct), 2)}")

    for name, value in sorted(LLM_STATS.items()):
        lines.append(f"sakhi_{name} {value}")

    return "\n".join(lines) + "\n"


def reset() -> None:
    """Testing hook."""
    with _lock:
        _counters.clear()
        _histograms.clear()

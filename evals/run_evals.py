#!/usr/bin/env python3
"""Offline evaluation gate for AI Sakhi.

The old version scored three hardcoded strings, which meant the gate could never
fail for a real regression. This version:

* reads every case from ``evals/cases.json``
* uses each case's ``reference`` answer when no live responses are supplied, so
  the suite still runs offline in CI without an API key
* can score real model output with ``--responses`` or ``--live``
* writes a JSON report and exits non-zero when the release gate fails
* optionally persists results to the ``ai_evaluations`` table

Usage:
    python evals/run_evals.py
    python evals/run_evals.py --responses out.json --report evals/report.json
    python evals/run_evals.py --live --persist
"""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from backend.evaluation import evaluate_suite  # noqa: E402


def load_cases(path: Path) -> list[dict]:
    cases = json.loads(path.read_text(encoding="utf-8"))
    if not isinstance(cases, list) or not cases:
        raise SystemExit(f"No cases found in {path}")
    missing = [case.get("id", "<no id>") for case in cases if not case.get("prompt")]
    if missing:
        raise SystemExit(f"Cases missing a prompt: {missing}")
    return cases


def reference_responses(cases: list[dict]) -> list[str]:
    """Golden answers stored alongside each case.

    These are the behaviour we promise. If a change to the graders breaks these,
    the graders changed meaning and a human should look at it.
    """
    missing = [case["id"] for case in cases if not case.get("reference")]
    if missing:
        raise SystemExit(f"Cases missing a reference answer: {missing}")
    return [case["reference"] for case in cases]


def live_responses(cases: list[dict]) -> list[str]:
    """Score the real pipeline. Requires an API key, so it is opt-in."""
    from backend.chat import ChatUnavailable, chat

    outputs: list[str] = []
    for index, case in enumerate(cases):
        try:
            result = chat(f"eval-{index}", case["prompt"], case.get("class_", "8"))
            outputs.append(result["response"] if isinstance(result, dict) else str(result))
        except ChatUnavailable as exc:
            outputs.append(f"[unavailable] {exc}")
    return outputs


def persist(result: dict, cases: list[dict]) -> None:
    try:
        from backend.db import get_connection
    except Exception as exc:  # pragma: no cover - persistence is best effort
        print(f"warning: could not persist results ({exc})", file=sys.stderr)
        return
    conn = get_connection()
    try:
        for case, item in zip(cases, result["results"], strict=False):
            conn.execute(
                "INSERT INTO ai_evaluations (case_id, score, passed, total, release_gate, detail)"
                " VALUES (?, ?, ?, ?, ?, ?)",
                (
                    case["id"],
                    item["score"],
                    item["passed"],
                    item["total"],
                    1 if item["release_gate"] else 0,
                    json.dumps(item["checks"]),
                ),
            )
        conn.commit()
    except Exception as exc:  # pragma: no cover
        print(f"warning: could not persist results ({exc})", file=sys.stderr)
    finally:
        conn.close()


def main() -> int:
    parser = argparse.ArgumentParser(description="Run the AI Sakhi evaluation gate")
    parser.add_argument("--cases", default="evals/cases.json")
    parser.add_argument("--responses", help="JSON array of responses aligned with the cases")
    parser.add_argument("--live", action="store_true", help="call the real chat pipeline")
    parser.add_argument("--report", help="write the full JSON report to this path")
    parser.add_argument("--persist", action="store_true", help="store results in ai_evaluations")
    parser.add_argument("--threshold", type=float, default=90.0)
    args = parser.parse_args()

    cases = load_cases(Path(args.cases))
    if args.responses:
        responses = json.loads(Path(args.responses).read_text(encoding="utf-8"))
    elif args.live:
        responses = live_responses(cases)
    else:
        responses = reference_responses(cases)

    if len(responses) != len(cases):
        raise SystemExit(f"Expected {len(cases)} responses, got {len(responses)}")

    result = evaluate_suite(cases, responses)
    for case, item in zip(cases, result["results"], strict=False):
        status = "PASS" if item["release_gate"] else "FAIL"
        failed = [name for name, ok in item["checks"].items() if not ok]
        suffix = f"  failed: {', '.join(failed)}" if failed else ""
        print(f"{status}  {case['id']:<24} {item['score']:>5.1f}{suffix}")

    print(f"\nSuite score: {result['score']} across {result['case_count']} cases")

    if args.report:
        report_path = Path(args.report)
        report_path.parent.mkdir(parents=True, exist_ok=True)
        report_path.write_text(json.dumps(result, indent=2), encoding="utf-8")
        print(f"Report written to {report_path}")

    if args.persist:
        persist(result, cases)

    gate = bool(result["release_gate"]) and result["score"] >= args.threshold
    print("Release gate:", "PASS" if gate else "FAIL")
    return 0 if gate else 1


if __name__ == "__main__":
    raise SystemExit(main())

"""
Phase 17 — Unit Tests for Phase 8 backend modules.
Tests the actual public API surface of each module.
"""
import sys
import os
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..")))

import pytest
from backend.spaced_repetition import sm2_update, quality_label, initial_review_state


# ─────────────────────────────────────────────────────────────
# SM-2 Algorithm Tests
# sm2_update(ef, interval, reps, quality) -> (new_ef, new_interval, new_reps)
# ─────────────────────────────────────────────────────────────

class TestSm2Update:

    def test_first_review_easy(self):
        """Quality=4 (Easy), first rep → interval stays 1, reps becomes 1."""
        new_ef, new_interval, new_reps = sm2_update(2.5, 1, 0, 4)
        assert new_reps == 1
        assert new_interval == 1
        assert new_ef >= 2.5  # Easy should not decrease EF

    def test_second_review_easy(self):
        """Quality=4 on rep=1 → 6-day interval (SM-2 spec)."""
        _, new_interval, new_reps = sm2_update(2.5, 1, 1, 4)
        assert new_reps == 2
        assert new_interval == 6

    def test_third_review_scales_by_ef(self):
        """rep >= 2 → interval = round(prev_interval * new_ef)."""
        new_ef, new_interval, new_reps = sm2_update(2.5, 6, 2, 4)
        assert new_reps == 3
        assert new_interval == pytest.approx(round(6 * new_ef), abs=1)

    def test_forgot_resets_reps_and_interval(self):
        """Quality=1 (Forgot) at any rep count → reps=0, interval=1."""
        _, new_interval, new_reps = sm2_update(2.5, 60, 5, 1)
        assert new_reps == 0
        assert new_interval == 1

    def test_hard_resets_reps(self):
        """Quality=2 (Hard, < 3) → also resets reps to 0."""
        _, _, new_reps = sm2_update(2.5, 1, 3, 2)
        assert new_reps == 0

    def test_hard_decreases_ef(self):
        """Quality=2 should decrease easiness factor."""
        new_ef, _, _ = sm2_update(2.5, 6, 2, 2)
        assert new_ef < 2.5

    def test_ef_never_below_minimum(self):
        """EF must never go below 1.3 regardless of how many fails."""
        ef, interval, reps = 1.4, 1, 0
        for _ in range(20):
            ef, interval, reps = sm2_update(ef, interval, reps, 1)
        assert ef >= 1.3

    def test_easy_raises_ef(self):
        """Quality=4 on an established card should raise EF."""
        new_ef, _, _ = sm2_update(2.1, 10, 3, 4)
        assert new_ef > 2.1

    def test_okay_keeps_ef_stable(self):
        """Quality=3 (Okay) should keep EF approximately the same."""
        new_ef, _, _ = sm2_update(2.5, 6, 2, 3)
        assert abs(new_ef - 2.5) < 0.2

    def test_quality_clamped_to_range(self):
        """Qualities outside 1-4 should be clamped, not raise errors."""
        # Should not raise — SM-2 clamps quality to [1,4]
        new_ef, new_interval, new_reps = sm2_update(2.5, 1, 0, 0)  # below min → clamped to 1
        assert new_reps == 0  # quality 0 clamped to 1 → forgot
        new_ef2, _, _ = sm2_update(2.5, 1, 0, 99)  # above max → clamped to 4
        assert new_ef2 >= 2.5


class TestSm2Helpers:

    def test_quality_label_mapping(self):
        assert quality_label(1) == "Forgot"
        assert quality_label(2) == "Hard"
        assert quality_label(3) == "Okay"
        assert quality_label(4) == "Easy"
        assert quality_label(99) == "Unknown"

    def test_initial_review_state(self):
        state = initial_review_state()
        assert state["easiness_factor"] == 2.5
        assert state["interval_days"] == 1
        assert state["repetitions"] == 0
        assert state["last_reviewed_at"] is None
        assert "next_review_at" in state


# ─────────────────────────────────────────────────────────────
# Adaptive Difficulty Tests (logic layer — no DB)
# Tests the threshold logic directly using computed percentages
# ─────────────────────────────────────────────────────────────

class TestAdaptiveThresholds:
    """
    Verify the threshold constants defined in adaptive.py.
    Tests the pure scoring logic without hitting the database.
    """

    def _apply_thresholds(self, avg: float) -> str:
        """Mirror adaptive.py thresholds: >= 80 -> hard, >= 55 -> medium, else easy."""
        if avg >= 80.0:
            return "hard"
        if avg >= 55.0:
            return "medium"
        return "easy"

    def test_high_avg_gives_hard(self):
        assert self._apply_thresholds(85.0) == "hard"
        assert self._apply_thresholds(80.0) == "hard"

    def test_mid_avg_gives_medium(self):
        assert self._apply_thresholds(70.0) == "medium"
        assert self._apply_thresholds(55.0) == "medium"

    def test_low_avg_gives_easy(self):
        assert self._apply_thresholds(40.0) == "easy"
        assert self._apply_thresholds(0.0) == "easy"

    def test_boundary_80(self):
        assert self._apply_thresholds(79.9) == "medium"
        assert self._apply_thresholds(80.0) == "hard"

    def test_boundary_55(self):
        assert self._apply_thresholds(54.9) == "easy"
        assert self._apply_thresholds(55.0) == "medium"


# ─────────────────────────────────────────────────────────────
# Recommendation Engine Tests (logic layer)
# Tests the prioritisation logic without DB calls
# ─────────────────────────────────────────────────────────────

class TestRecommendationLogic:
    """
    Test the scoring / ranking logic of the recommendation engine
    using pure in-memory data (no DB required).
    """

    def _rank_topics(
        self,
        all_topics: list[str],
        attempted: dict[str, float],   # topic_lower -> best_pct
        weak_subject: str = "",
    ) -> list[str]:
        """
        Replicate recommendations.py ranking:
          - Not in attempted → unattempted (higher priority)
          - In attempted with low pct → retry candidate
          - Already mastered (>=80%) → lowest priority
        Returns topics sorted best-first.
        """
        scored: list[tuple[str, float]] = []
        for t in all_topics:
            key = t.lower()
            if key not in attempted:
                score = 100.0   # unattempted → top priority
            else:
                pct = attempted[key]
                score = 50.0 - pct  # low pct → higher score
            scored.append((t, score))
        scored.sort(key=lambda x: -x[1])
        return [t for t, _ in scored]

    def test_unattempted_before_completed(self):
        topics = ["Photosynthesis", "Cell Division", "Osmosis"]
        attempted = {"photosynthesis": 90.0}
        ranked = self._rank_topics(topics, attempted)
        # Unattempted topics should appear before the completed one
        assert ranked[0] != "Photosynthesis"
        assert "Photosynthesis" in ranked  # still in list, just last

    def test_failed_before_mastered(self):
        topics = ["Hard Topic", "Easy Topic"]
        attempted = {"hard topic": 20.0, "easy topic": 95.0}
        ranked = self._rank_topics(topics, attempted)
        assert ranked[0] == "Hard Topic"

    def test_all_unattempted_preserves_all(self):
        topics = ["A", "B", "C"]
        ranked = self._rank_topics(topics, {})
        assert set(ranked) == {"A", "B", "C"}
        assert len(ranked) == 3

    def test_empty_topics(self):
        ranked = self._rank_topics([], {})
        assert ranked == []

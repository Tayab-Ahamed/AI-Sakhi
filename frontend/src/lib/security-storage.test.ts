import { beforeEach, describe, expect, it } from "vitest";
import { getStoredAuth, saveStoredAuth } from "./user";
import { getOfflineCachedQuiz, listOfflineCachedQuizzes, saveQuizToOfflineCache } from "./use-pwa";

beforeEach(() => localStorage.clear());

describe("credential-free device metadata", () => {
  it("removes a legacy JWT when reading stored metadata", () => {
    localStorage.setItem("sakhi_auth", JSON.stringify({ token: "private-jwt", user_id: 1, expires_at: "2030-01-01" }));
    expect(getStoredAuth()).not.toHaveProperty("token");
    expect(localStorage.getItem("sakhi_auth")).not.toContain("private-jwt");
  });
  it("never persists a token returned by an older server", () => {
    saveStoredAuth({ token: "private-jwt", token_type: "Bearer", user_id: 1, expires_at: "2030-01-01" });
    expect(localStorage.getItem("sakhi_auth")).not.toContain("private-jwt");
  });
  it("returns null for corrupt metadata", () => {
    localStorage.setItem("sakhi_auth", "broken");
    expect(getStoredAuth()).toBeNull();
  });
});

describe("offline quiz isolation", () => {
  const quiz = { topic: "Fractions", difficulty: "easy", class_: "9", language: "English", questions: [{ question: "Private practice" }], cachedAt: "2026-10-07" };
  function account(id: number, organizationId = 1) {
    localStorage.setItem("sakhi_user", JSON.stringify({ user_id: id, organization_id: organizationId }));
  }
  it("does not show another learner's cached quiz", () => {
    account(1); saveQuizToOfflineCache(quiz); account(2);
    expect(listOfflineCachedQuizzes()).toEqual([]);
  });
  it("does not reuse an old school's quiz", () => {
    account(1); saveQuizToOfflineCache(quiz); account(1, 2);
    expect(listOfflineCachedQuizzes()).toEqual([]);
  });
  it("requires exact topic, difficulty, class and language", () => {
    account(1); saveQuizToOfflineCache(quiz);
    expect(getOfflineCachedQuiz("Fractions", "easy", "9", "English")).toEqual(quiz);
    expect(getOfflineCachedQuiz("Geometry", "easy", "9", "English")).toBeNull();
    expect(getOfflineCachedQuiz("Fractions", "easy", "10", "English")).toBeNull();
    expect(getOfflineCachedQuiz("Fractions", "easy", "9", "Hindi")).toBeNull();
  });
  it("drops the legacy shared cache and deduplicates packs", () => {
    account(1); localStorage.setItem("sakhi_offline_quiz_cache", JSON.stringify([quiz]));
    saveQuizToOfflineCache(quiz); saveQuizToOfflineCache(quiz);
    expect(localStorage.getItem("sakhi_offline_quiz_cache")).toBeNull();
    expect(listOfflineCachedQuizzes()).toHaveLength(1);
  });
  it("does not cache without an account", () => {
    saveQuizToOfflineCache(quiz);
    expect(listOfflineCachedQuizzes()).toEqual([]);
  });
});

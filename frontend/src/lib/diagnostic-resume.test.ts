import { afterEach, expect, it, vi } from "vitest";
import { clearDiagnosticResume, readDiagnosticResume, saveDiagnosticResume } from "./diagnostic-resume";

const owner = { user_id: 1, organization_id: 1, class_: "8" };
const id = "00000000-0000-4000-8000-000000000001";
afterEach(() => { vi.restoreAllMocks(); localStorage.clear(); });

it("stores only an attempt UUID in exact school, learner and class scope", () => {
  saveDiagnosticResume(owner, id);
  expect(readDiagnosticResume(owner)).toBe(id);
  expect(readDiagnosticResume({ ...owner, user_id: 2 })).toBeNull();
  expect(readDiagnosticResume({ ...owner, organization_id: 2 })).toBeNull();
  expect(readDiagnosticResume({ ...owner, class_: "9" })).toBeNull();
  expect(localStorage.length).toBe(1);
  expect(localStorage.key(0)).toBe("sakhi_diagnostic_attempt:1:1:8");
  expect(localStorage.getItem(localStorage.key(0)!)).toBe(id);
  clearDiagnosticResume(owner);
  expect(readDiagnosticResume(owner)).toBeNull();
});

it("rejects corrupt references and invalid account scope", () => {
  localStorage.setItem("sakhi_diagnostic_attempt:1:1:8", '{"answers":{"1":0}}');
  expect(readDiagnosticResume(owner)).toBeNull();
  expect(localStorage.length).toBe(0);
  saveDiagnosticResume(owner, "not-an-attempt");
  saveDiagnosticResume({ ...owner, user_id: 0 }, id);
  expect(localStorage.length).toBe(0);
});

it("uses an unambiguous encoded class scope", () => {
  saveDiagnosticResume({ ...owner, class_: "8:A" }, id);
  expect(localStorage.key(0)).toBe("sakhi_diagnostic_attempt:1:1:8%3AA");
  expect(readDiagnosticResume({ ...owner, class_: "8:A" })).toBe(id);
});

it("fails safely when browser storage is blocked", () => {
  vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => { throw new Error("blocked"); });
  vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => { throw new Error("blocked"); });
  vi.spyOn(Storage.prototype, "removeItem").mockImplementation(() => { throw new Error("blocked"); });
  expect(() => saveDiagnosticResume(owner, id)).not.toThrow();
  expect(readDiagnosticResume(owner)).toBeNull();
  expect(() => clearDiagnosticResume(owner)).not.toThrow();
});

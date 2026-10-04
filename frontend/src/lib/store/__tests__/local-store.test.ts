import "fake-indexeddb/auto";
import { beforeEach, describe, expect, it } from "vitest";
import { LocalStore, mergeChats } from "../local-store";
import type { StoredChat } from "../types";

const chat = (over: Partial<StoredChat> = {}): StoredChat => ({
  id: "s1", userId: 1, title: "Gravity", updatedAt: 100, deviceId: "d1",
  messages: [{ role: "user", content: "hi", at: 1 }], ...over,
});

describe("LocalStore", () => {
  let store: LocalStore;
  beforeEach(() => { store = new LocalStore(`test-${Math.random()}`); });

  it("saves and lists chats newest first, per user", async () => {
    await store.saveChat(chat({ id: "a", updatedAt: 1 }));
    await store.saveChat(chat({ id: "b", updatedAt: 2 }));
    await store.saveChat(chat({ id: "c", userId: 2 }));
    expect((await store.listChats(1)).map((c) => c.id)).toEqual(["b", "a"]);
  });

  it("merges messages from two devices without losing any", () => {
    const a = chat({ messages: [{ role: "user", content: "q1", at: 1 }], updatedAt: 10 });
    const b = chat({ messages: [{ role: "assistant", content: "a1", at: 2 }], updatedAt: 20, deviceId: "d2" });
    const m = mergeChats(a, b);
    expect(m.messages.map((x) => x.content)).toEqual(["q1", "a1"]);
    expect(m.deviceId).toBe("d2");
  });

  it("does not duplicate identical messages on re-save", async () => {
    await store.saveChat(chat());
    await store.saveChat(chat());
    expect((await store.getChat(1, "s1"))!.messages).toHaveLength(1);
  });

  it("exports and imports a bundle round-trip", async () => {
    await store.saveChat(chat());
    await store.saveArtifact({ id: "n1", userId: 1, type: "note", title: "N", payload: { x: 1 }, updatedAt: 5, deviceId: "d1" });
    const bundle = await store.exportAll(1);
    const other = new LocalStore(`test-${Math.random()}`);
    expect(await other.importAll(bundle)).toEqual({ chats: 1, artifacts: 1 });
    expect(await other.listArtifacts(1, "note")).toHaveLength(1);
  });

  it("rejects an unsupported backup file", async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await expect(store.importAll({ version: 2 } as any)).rejects.toThrow("Unsupported");
  });
});

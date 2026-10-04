import Dexie, { type Table } from "dexie";
import type { DataStore, ExportBundle, StoredArtifact, StoredChat, StoredMessage } from "./types";

class SakhiDB extends Dexie {
  chats!: Table<StoredChat, [number, string]>;
  artifacts!: Table<StoredArtifact, [number, string]>;
  constructor(name: string) {
    super(name);
    this.version(1).stores({
      chats: "[userId+id], userId, updatedAt",
      artifacts: "[userId+id], userId, type, updatedAt",
    });
  }
}

/** Merge two copies of one chat: union of messages (by role+content+time), newest metadata wins. */
export function mergeChats(a: StoredChat, b: StoredChat): StoredChat {
  const seen = new Set<string>();
  const messages: StoredMessage[] = [];
  for (const m of [...a.messages, ...b.messages].sort((x, y) => x.at - y.at)) {
    const key = `${m.role}|${m.at}|${m.content}`;
    if (!seen.has(key)) {
      seen.add(key);
      messages.push(m);
    }
  }
  const newest = a.updatedAt >= b.updatedAt ? a : b;
  return { ...newest, messages };
}

export class LocalStore implements DataStore {
  private db: SakhiDB;
  constructor(dbName = "sakhi-local") {
    this.db = new SakhiDB(dbName);
  }

  async listChats(userId: number) {
    const rows = await this.db.chats.where("userId").equals(userId).toArray();
    return rows.sort((x, y) => y.updatedAt - x.updatedAt);
  }
  getChat(userId: number, id: string) {
    return this.db.chats.get([userId, id]);
  }
  async saveChat(chat: StoredChat) {
    const existing = await this.db.chats.get([chat.userId, chat.id]);
    await this.db.chats.put(existing ? mergeChats(existing, chat) : chat);
  }
  deleteChat(userId: number, id: string) {
    return this.db.chats.delete([userId, id]);
  }

  async listArtifacts(userId: number, type?: string) {
    const rows = await this.db.artifacts.where("userId").equals(userId).toArray();
    return rows.filter((r) => !type || r.type === type).sort((x, y) => y.updatedAt - x.updatedAt);
  }
  async saveArtifact(artifact: StoredArtifact) {
    const existing = await this.db.artifacts.get([artifact.userId, artifact.id]);
    if (!existing || artifact.updatedAt >= existing.updatedAt) await this.db.artifacts.put(artifact);
  }
  deleteArtifact(userId: number, id: string) {
    return this.db.artifacts.delete([userId, id]);
  }

  async exportAll(userId: number): Promise<ExportBundle> {
    return {
      version: 1,
      exportedAt: Date.now(),
      userId,
      chats: await this.listChats(userId),
      artifacts: await this.listArtifacts(userId),
    };
  }

  async importAll(bundle: ExportBundle) {
    if (!bundle || bundle.version !== 1 || !Array.isArray(bundle.chats) || !Array.isArray(bundle.artifacts)) {
      throw new Error("Unsupported backup file");
    }
    for (const c of bundle.chats) await this.saveChat({ ...c, userId: bundle.userId });
    for (const a of bundle.artifacts) await this.saveArtifact({ ...a, userId: bundle.userId });
    return { chats: bundle.chats.length, artifacts: bundle.artifacts.length };
  }
}

export function getDeviceId(): string {
  if (typeof window === "undefined") return "server";
  let id = localStorage.getItem("sakhi_device_id");
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem("sakhi_device_id", id);
  }
  return id;
}

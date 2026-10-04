/** Storage contract for a learner's personal data. Implementations: LocalStore (device). */
export type StoredMessage = { role: "user" | "assistant"; content: string; citations?: unknown[]; at: number };

export type StoredChat = {
  id: string; // session id
  userId: number;
  title: string;
  messages: StoredMessage[];
  updatedAt: number;
  deviceId: string;
};

export type StoredArtifact = {
  id: string;
  userId: number;
  type: string;
  title: string;
  payload: unknown;
  updatedAt: number;
  deviceId: string;
};

export type ExportBundle = {
  version: 1;
  exportedAt: number;
  userId: number;
  chats: StoredChat[];
  artifacts: StoredArtifact[];
};

export interface DataStore {
  listChats(userId: number): Promise<StoredChat[]>;
  getChat(userId: number, id: string): Promise<StoredChat | undefined>;
  saveChat(chat: StoredChat): Promise<void>;
  deleteChat(userId: number, id: string): Promise<void>;
  listArtifacts(userId: number, type?: string): Promise<StoredArtifact[]>;
  saveArtifact(artifact: StoredArtifact): Promise<void>;
  deleteArtifact(userId: number, id: string): Promise<void>;
  exportAll(userId: number): Promise<ExportBundle>;
  importAll(bundle: ExportBundle): Promise<{ chats: number; artifacts: number }>;
}

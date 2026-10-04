"use client";

import { useRef, useState } from "react";
import { DownloadSimple, UploadSimple } from "@phosphor-icons/react";
import { LocalStore } from "@/lib/store/local-store";
import type { ExportBundle } from "@/lib/store/types";

let sharedStore: LocalStore | null = null;
export function getLocalStore() {
  if (!sharedStore) sharedStore = new LocalStore();
  return sharedStore;
}

/** Export / import the learner's on-device data as a JSON file they own. */
export default function MyDataCard({ userId }: { userId: number }) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [status, setStatus] = useState("");

  const exportData = async () => {
    const bundle = await getLocalStore().exportAll(userId);
    const url = URL.createObjectURL(new Blob([JSON.stringify(bundle)], { type: "application/json" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `ai-sakhi-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    setStatus(`Exported ${bundle.chats.length} chats and ${bundle.artifacts.length} saved items.`);
  };

  const importData = async (file: File) => {
    try {
      const bundle = JSON.parse(await file.text()) as ExportBundle;
      if (bundle.userId !== userId) {
        setStatus("This backup belongs to a different account.");
        return;
      }
      const r = await getLocalStore().importAll(bundle);
      setStatus(`Restored ${r.chats} chats and ${r.artifacts} saved items.`);
    } catch {
      setStatus("That file is not a valid AI Sakhi backup.");
    }
  };

  return (
    <div className="card" style={{ padding: 20, marginTop: 16 }}>
      <h3 style={{ fontSize: 14, fontWeight: 600, marginBottom: 6, color: "var(--text-primary)" }}>My Data</h3>
      <p style={{ fontSize: 13, color: "var(--text-secondary)", marginBottom: 12 }}>
        Your chats are kept on this device. Download a backup you own, or restore one.
      </p>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <button type="button" className="landing-button landing-button-primary" onClick={() => void exportData()}>
          <DownloadSimple size={15} /> Download backup
        </button>
        <button type="button" className="landing-button landing-button-secondary" onClick={() => fileRef.current?.click()}>
          <UploadSimple size={15} /> Restore backup
        </button>
        <input
          ref={fileRef}
          type="file"
          accept="application/json"
          hidden
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) void importData(f);
            e.target.value = "";
          }}
        />
      </div>
      {status && <p role="status" style={{ fontSize: 13, marginTop: 10, color: "var(--text-secondary)" }}>{status}</p>}
    </div>
  );
}

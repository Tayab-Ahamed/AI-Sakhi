"use client";

import { useEffect, useRef, useState } from "react";
import { Bell } from "lucide-react";
import { useRouter } from "next/navigation";
import { useUser } from "@/lib/user-context";

const BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

type Notification = {
  id: string;
  type: "info" | "warning" | "success";
  title: string;
  body: string;
  href?: string;
};

export default function NotificationCenter() {
  const { user } = useUser();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unread, setUnread] = useState(0);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!user?.user_id) return;
    fetch(`${BASE_URL}/notifications/${user.user_id}`, { credentials: "include" })
      .then((r) => r.json())
      .then((data) => {
        setNotifications(data.notifications || []);
        setUnread(data.unread_count || 0);
      })
      .catch(() => {});
  }, [user?.user_id]);

  // Close on outside click
  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    if (open) document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, [open]);

  const handleClick = (n: Notification) => {
    setOpen(false);
    if (n.href) router.push(n.href);
  };

  return (
    <div className="notification-bell" ref={panelRef}>
      <button
        className="btn-icon"
        onClick={() => { setOpen((o) => !o); setUnread(0); }}
        title="Notifications"
        aria-label="Open notifications"
        style={{ position: "relative" }}
      >
        <Bell size={16} />
        {unread > 0 && <span className="notification-badge">{unread}</span>}
      </button>

      {open && (
        <div className="notification-panel">
          <div style={{ padding: "12px 14px", borderBottom: "1px solid var(--border-subtle)", fontWeight: 700, fontSize: 13, color: "var(--text-primary)" }}>
            🔔 Notifications
          </div>
          {notifications.length === 0 ? (
            <div style={{ padding: 20, textAlign: "center", color: "var(--text-muted)", fontSize: 13 }}>All caught up! ✨</div>
          ) : (
            notifications.map((n) => (
              <div key={n.id} className="notification-item" onClick={() => handleClick(n)}>
                <div style={{ display: "flex", gap: 10 }}>
                  <div className={`notification-dot-${n.type}`} />
                  <div>
                    <div className="notification-item-title">{n.title}</div>
                    <div className="notification-item-body">{n.body}</div>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}

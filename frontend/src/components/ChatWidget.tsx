import { useEffect, useRef, useState } from "react";
import { MessageSquare, X, Send, ChevronLeft, Users, Lock, Smile } from "lucide-react";
import EmojiPicker from "emoji-picker-react";
import { Theme } from "emoji-picker-react";
import type { EmojiClickData } from "emoji-picker-react";
import { supabase } from "../lib/supabase";
import { useAuth } from "../auth/AuthProvider";

type Message = {
  id: string;
  sender_id: string;
  sender_name: string;
  recipient_id: string | null;
  content: string;
  created_at: string;
};

type ChatUser = {
  id: string;
  name: string;
  avatarUrl: string | null;
  isOnline: boolean;
};

type Tab = "global" | "private";

function formatTime(iso: string) {
  const d = new Date(iso);
  return d.toLocaleTimeString("pl-PL", { hour: "2-digit", minute: "2-digit" });
}

function getUserInitials(name: string) {
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
  return name.slice(0, 2).toUpperCase();
}

type MessageBubbleProps = {
  msg: Message;
  isMine: boolean;
};

function MessageBubble({ msg, isMine }: MessageBubbleProps) {
  return (
    <div className={`flex gap-2 ${isMine ? "flex-row-reverse" : "flex-row"}`}>
      <div
        className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-slate-700 text-[10px] font-semibold text-white"
        title={msg.sender_name}
      >
        {getUserInitials(msg.sender_name)}
      </div>
      <div className={`max-w-[75%] ${isMine ? "items-end" : "items-start"} flex flex-col gap-0.5`}>
        {!isMine && (
          <span className="px-1 text-[10px] text-slate-400">{msg.sender_name}</span>
        )}
        <div
          className={`rounded-2xl px-3 py-2 text-sm leading-relaxed ${
            isMine
              ? "rounded-tr-sm bg-sky-500 text-white"
              : "rounded-tl-sm bg-slate-700 text-slate-100"
          }`}
        >
          {msg.content}
        </div>
        <span className="px-1 text-[10px] text-slate-500">{formatTime(msg.created_at)}</span>
      </div>
    </div>
  );
}

type ChatPanelProps = {
  tab: Tab;
  currentUserId: string;
  currentUserName: string;
  recipientId: string | null;
  recipientName: string | null;
  onBackToUsers: () => void;
};

function ChatPanel({ tab, currentUserId, currentUserName, recipientId, recipientName, onBackToUsers }: ChatPanelProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const emojiPickerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (emojiPickerRef.current && !emojiPickerRef.current.contains(e.target as Node)) {
        setShowEmojiPicker(false);
      }
    }
    if (showEmojiPicker) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [showEmojiPicker]);

  useEffect(() => {
    setMessages([]);

    let query = supabase
      .from("messages")
      .select("*")
      .order("created_at", { ascending: true })
      .limit(100);

    if (tab === "global") {
      query = query.is("recipient_id", null);
    } else if (recipientId) {
      query = query.or(
        `and(sender_id.eq.${currentUserId},recipient_id.eq.${recipientId}),and(sender_id.eq.${recipientId},recipient_id.eq.${currentUserId})`
      );
    }

    query.then(({ data }) => {
      if (data) setMessages(data as Message[]);
    });

    const channelName = tab === "global" ? "chat:global" : `chat:dm:${[currentUserId, recipientId].sort().join("_")}`;
    const channel = supabase
      .channel(channelName)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "messages",
          filter: tab === "global"
            ? "recipient_id=is.null"
            : `sender_id=in.(${currentUserId},${recipientId})`,
        },
        (payload) => {
          const newMsg = payload.new as Message;
          if (tab === "private") {
            const isRelevant =
              (newMsg.sender_id === currentUserId && newMsg.recipient_id === recipientId) ||
              (newMsg.sender_id === recipientId && newMsg.recipient_id === currentUserId);
            if (!isRelevant) return;
          }
          setMessages((prev) => [...prev, newMsg]);
        }
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [tab, currentUserId, recipientId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function handleSend() {
    const text = input.trim();
    if (!text || sending) return;
    setSending(true);
    setInput("");

    await supabase.from("messages").insert({
      sender_id: currentUserId,
      sender_name: currentUserName,
      recipient_id: tab === "private" ? recipientId : null,
      content: text,
    });

    setSending(false);
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      void handleSend();
    }
  }

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      {/* Sub-header for private chat */}
      {tab === "private" && (
        <div className="flex items-center gap-2 border-b border-slate-700 px-3 py-2">
          <button
            type="button"
            onClick={onBackToUsers}
            className="flex h-6 w-6 items-center justify-center rounded text-slate-400 hover:text-white"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <span className="text-sm font-medium text-slate-200">{recipientName}</span>
          <Lock className="h-3 w-3 text-slate-500" />
        </div>
      )}

      {/* Messages */}
      <div className="flex-1 space-y-3 overflow-y-auto p-3">
        {messages.length === 0 && (
          <p className="py-8 text-center text-xs text-slate-500">
            {tab === "global" ? "Brak wiadomości. Napisz pierwszą!" : `Napisz do ${recipientName}`}
          </p>
        )}
        {messages.map((msg) => (
          <MessageBubble key={msg.id} msg={msg} isMine={msg.sender_id === currentUserId} />
        ))}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="relative border-t border-slate-700 p-2">
        {showEmojiPicker && (
          <div ref={emojiPickerRef} className="absolute bottom-16 left-2 z-50">
            <EmojiPicker
              onEmojiClick={(data: EmojiClickData) => {
                setInput((prev) => prev + data.emoji);
                setShowEmojiPicker(false);
              }}
              theme={Theme.DARK}
              width={280}
              height={350}
            />
          </div>
        )}
        <div className="flex items-end gap-2">
          <button
            type="button"
            onClick={() => setShowEmojiPicker((v) => !v)}
            className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl text-slate-400 transition hover:bg-slate-700 hover:text-slate-200"
          >
            <Smile className="h-5 w-5" />
          </button>
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Napisz wiadomość..."
            rows={1}
            className="flex-1 resize-none rounded-xl bg-slate-700 px-3 py-2 text-sm text-slate-100 placeholder-slate-500 outline-none focus:ring-1 focus:ring-sky-500"
            style={{ maxHeight: "96px" }}
          />
          <button
            type="button"
            onClick={() => void handleSend()}
            disabled={!input.trim() || sending}
            className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl bg-sky-500 text-white transition hover:bg-sky-600 disabled:opacity-40"
          >
            <Send className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}

type UserListProps = {
  users: ChatUser[];
  onSelect: (user: ChatUser) => void;
};

function UserList({ users, onSelect }: UserListProps) {
  return (
    <div className="flex-1 overflow-y-auto p-2">
      {users.length === 0 && (
        <p className="py-8 text-center text-xs text-slate-500">Brak innych użytkowników</p>
      )}
      {users.map((user) => (
        <button
          key={user.id}
          type="button"
          onClick={() => onSelect(user)}
          className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left transition hover:bg-slate-700"
        >
          <div className="relative">
            {user.avatarUrl ? (
              <img src={user.avatarUrl} alt={user.name} className="h-8 w-8 rounded-full object-cover" />
            ) : (
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-600 text-xs font-semibold text-white">
                {getUserInitials(user.name)}
              </div>
            )}
            <span
              className={`absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-slate-800 ${
                user.isOnline ? "bg-emerald-400" : "bg-slate-500"
              }`}
            />
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-slate-200">{user.name}</p>
            <p className="text-[11px] text-slate-500">{user.isOnline ? "Online" : "Offline"}</p>
          </div>
          <MessageSquare className="h-4 w-4 flex-shrink-0 text-slate-600" />
        </button>
      ))}
    </div>
  );
}

type ChatWidgetProps = {
  chatUsers: ChatUser[];
  pendingUser?: ChatUser | null;
  onPendingUserConsumed?: () => void;
};

export function ChatWidget({ chatUsers, pendingUser, onPendingUserConsumed }: ChatWidgetProps) {
  const { session, displayName } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [tab, setTab] = useState<Tab>("global");
  const [selectedUser, setSelectedUser] = useState<ChatUser | null>(null);
  const [unreadCount, setUnreadCount] = useState(0);
  const lastSeenRef = useRef<string>(new Date().toISOString());

  useEffect(() => {
    if (pendingUser) {
      setSelectedUser(pendingUser);
      setTab("private");
      setIsOpen(true);
      onPendingUserConsumed?.();
    }
  }, [pendingUser, onPendingUserConsumed]);

  const currentUserId = session?.user.id ?? "";
  const otherUsers = chatUsers.filter((u) => u.id !== currentUserId);

  // Track unread messages when widget is closed
  useEffect(() => {
    if (isOpen) {
      setUnreadCount(0);
      lastSeenRef.current = new Date().toISOString();
      return;
    }

    const channel = supabase
      .channel("chat:unread-tracker")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "messages" },
        (payload) => {
          const msg = payload.new as Message;
          if (msg.sender_id !== currentUserId) {
            setUnreadCount((n) => n + 1);
          }
        }
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [isOpen, currentUserId]);

  function handleSelectUser(user: ChatUser) {
    setSelectedUser(user);
    setTab("private");
  }

  function handleTabChange(next: Tab) {
    setTab(next);
    if (next === "global") setSelectedUser(null);
  }

  if (!session) return null;

  return (
    <div className="fixed bottom-5 right-5 z-50">
      {/* Popup */}
      {isOpen && (
        <div className="mb-3 flex h-[520px] w-80 flex-col overflow-hidden rounded-2xl bg-slate-800 shadow-2xl ring-1 ring-slate-700">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-slate-700 px-4 py-3">
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => handleTabChange("global")}
                className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium transition ${
                  tab === "global" && selectedUser === null
                    ? "bg-sky-500 text-white"
                    : "text-slate-400 hover:text-white"
                }`}
              >
                <Users className="h-3.5 w-3.5" />
                Ogólny
              </button>
              <button
                type="button"
                onClick={() => handleTabChange("private")}
                className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium transition ${
                  tab === "private"
                    ? "bg-sky-500 text-white"
                    : "text-slate-400 hover:text-white"
                }`}
              >
                <Lock className="h-3.5 w-3.5" />
                Prywatny
              </button>
            </div>
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="flex h-6 w-6 items-center justify-center rounded-lg text-slate-400 transition hover:text-white"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Content */}
          {tab === "global" ? (
            <ChatPanel
              tab="global"
              currentUserId={currentUserId}
              currentUserName={displayName}
              recipientId={null}
              recipientName={null}
              onBackToUsers={() => {}}
            />
          ) : selectedUser ? (
            <ChatPanel
              tab="private"
              currentUserId={currentUserId}
              currentUserName={displayName}
              recipientId={selectedUser.id}
              recipientName={selectedUser.name}
              onBackToUsers={() => setSelectedUser(null)}
            />
          ) : (
            <UserList users={otherUsers} onSelect={handleSelectUser} />
          )}
        </div>
      )}

      {/* Floating button */}
      <button
        type="button"
        onClick={() => setIsOpen((v) => !v)}
        className="relative flex h-12 w-12 items-center justify-center rounded-full bg-sky-500 text-white shadow-lg transition hover:bg-sky-600 hover:shadow-xl"
      >
        {isOpen ? <X className="h-5 w-5" /> : <MessageSquare className="h-5 w-5" />}
        {!isOpen && unreadCount > 0 && (
          <span className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>
    </div>
  );
}

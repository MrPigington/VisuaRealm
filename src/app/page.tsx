"use client";

import React, {
  useState,
  useRef,
  useEffect,
  FormEvent,
  ChangeEvent,
} from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { Components } from "react-markdown";
import { motion } from "framer-motion";
import { supabase } from "@/lib/supabaseClient";

interface Message {
  role: "user" | "assistant";
  content: string;
  type?: "recap";
  fileUrl?: string;
}

interface Note {
  id: number;
  title: string;
  content: string;
}

interface ChatSession {
  id: string;
  title: string;
  createdAt: number;
  updatedAt: number;
  messageCount: number;
}

export default function ChatPage() {
  // --- CORE STATE ---
  const [user, setUser] = useState<any>(null);
  const [displayName, setDisplayName] = useState<string>("You");

  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  // Notes
  const [notes, setNotes] = useState<Note[]>([
    { id: 1, title: "New Note", content: "" },
  ]);
  const [activeNote, setActiveNote] = useState<number>(1);
  const [showNotes, setShowNotes] = useState(true);
  const [improving, setImproving] = useState(false);

  // Scroll / UI helpers
  const [showScrollToBottom, setShowScrollToBottom] = useState(false);
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);
  const [filePreviewUrl, setFilePreviewUrl] = useState<string | null>(null);
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  // Chats list
  const [chatSessions, setChatSessions] = useState<ChatSession[]>([]);
  const [activeChatId, setActiveChatId] = useState<string | null>(null);

  /* ------------------------------------------------------------------
   * AUTH + DISPLAY NAME
   * ------------------------------------------------------------------ */

  useEffect(() => {
    let ignore = false;

    async function initUser() {
      try {
        const { data } = await supabase.auth.getUser();
        if (ignore) return;
        const supaUser = data?.user ?? null;
        setUser(supaUser || null);

        // Load saved display name from localStorage (overrides everything)
        let savedName: string | null = null;
        if (typeof window !== "undefined") {
          savedName = window.localStorage.getItem("visuarealm_display_name");
        }

        if (savedName && savedName.trim()) {
          setDisplayName(savedName.trim());
          return;
        }

        // If logged in, default to email prefix or full_name
        if (supaUser) {
          const metaName =
            (supaUser.user_metadata &&
              (supaUser.user_metadata.full_name ||
                supaUser.user_metadata.name)) ||
            "";
          const emailPrefix =
            typeof supaUser.email === "string"
              ? supaUser.email.split("@")[0]
              : "";

          const finalName =
            metaName.trim() ||
            emailPrefix.trim() ||
            "You";

          setDisplayName(finalName);
        } else {
          setDisplayName("You");
        }
      } catch {
        // ignore auth errors for UI
      }
    }

    initUser();
    return () => {
      ignore = true;
    };
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!displayName.trim()) return;
    window.localStorage.setItem("visuarealm_display_name", displayName.trim());
  }, [displayName]);

  /* ------------------------------------------------------------------
   * NOTES: LOAD / SAVE LOCAL
   * ------------------------------------------------------------------ */

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const stored = localStorage.getItem("visuarealm_notes");
      const storedActive = localStorage.getItem("visuarealm_active_note");

      if (stored) {
        const parsed = JSON.parse(stored) as Note[];
        if (parsed.length > 0) {
          setNotes(parsed);
          const idNum = storedActive ? Number(storedActive) : parsed[0].id;
          setActiveNote(
            parsed.some((n) => n.id === idNum) ? idNum : parsed[0].id
          );
        }
      }
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    localStorage.setItem("visuarealm_notes", JSON.stringify(notes));
    localStorage.setItem("visuarealm_active_note", String(activeNote));
  }, [notes, activeNote]);

  /* ------------------------------------------------------------------
   * FILE PREVIEW
   * ------------------------------------------------------------------ */

  useEffect(() => {
    if (!file) {
      setFilePreviewUrl(null);
      return;
    }
    const url = URL.createObjectURL(file);
    setFilePreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  /* ------------------------------------------------------------------
   * AUTO SCROLL + SCROLL TO BOTTOM
   * ------------------------------------------------------------------ */

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    const el = scrollContainerRef.current;
    if (!el) return;

    const handleScroll = () => {
      const distance = el.scrollHeight - el.scrollTop - el.clientHeight;
      setShowScrollToBottom(distance > 120);
    };

    el.addEventListener("scroll", handleScroll);
    return () => el.removeEventListener("scroll", handleScroll);
  }, [messages.length]);

  /* ------------------------------------------------------------------
   * ESC TO HIDE NOTES
   * ------------------------------------------------------------------ */

  useEffect(() => {
    const fn = (e: KeyboardEvent) => {
      if (e.key === "Escape") setShowNotes(false);
    };
    window.addEventListener("keydown", fn);
    return () => window.removeEventListener("keydown", fn);
  }, []);

  /* ------------------------------------------------------------------
   * CHAT SESSIONS LOCAL PERSISTENCE
   * ------------------------------------------------------------------ */

  useEffect(() => {
    if (typeof window === "undefined") return;

    try {
      const stored = localStorage.getItem("visuarealm_chats_meta");
      if (stored) {
        const parsed = JSON.parse(stored) as ChatSession[];
        if (parsed.length) {
          setChatSessions(parsed);
          const first = parsed[0];
          setActiveChatId(first.id);

          const raw = localStorage.getItem(`visuarealm_chat_${first.id}`);
          if (raw) {
            const parsedMessages = JSON.parse(raw) as Message[];
            setMessages(parsedMessages);
          }
          return;
        }
      }

      // If nothing stored, create default chat
      const id = String(Date.now());
      const first: ChatSession = {
        id,
        title: "New VisuaRealm",
        createdAt: Date.now(),
        updatedAt: Date.now(),
        messageCount: 0,
      };
      setChatSessions([first]);
      setActiveChatId(id);
      setMessages([]);
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    localStorage.setItem("visuarealm_chats_meta", JSON.stringify(chatSessions));
  }, [chatSessions]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!activeChatId) return;

    try {
      localStorage.setItem(
        `visuarealm_chat_${activeChatId}`,
        JSON.stringify(messages)
      );

      setChatSessions((prev) =>
        prev.map((s) =>
          s.id === activeChatId
            ? {
                ...s,
                updatedAt: Date.now(),
                messageCount: messages.length,
                title:
                  s.title === "New VisuaRealm" || !s.title.trim()
                    ? deriveTitle(messages) || "New VisuaRealm"
                    : s.title,
              }
            : s
        )
      );
    } catch {
      // ignore
    }
  }, [messages, activeChatId]);

  function deriveTitle(msgs: Message[]): string {
    const firstUser = msgs.find((m) => m.role === "user");
    if (!firstUser || !firstUser.content.trim()) return "New VisuaRealm";
    const firstLine = firstUser.content.split("\n")[0].trim();
    if (!firstLine) return "New VisuaRealm";
    return firstLine.length > 40 ? firstLine.slice(0, 40) + "..." : firstLine;
  }

  /* ------------------------------------------------------------------
   * NOTES HANDLERS
   * ------------------------------------------------------------------ */

  function addNote() {
    const newNote: Note = {
      id: Date.now(),
      title: "Untitled",
      content: "",
    };
    setNotes((prev) => [...prev, newNote]);
    setActiveNote(newNote.id);
  }

  function deleteNote(id: number) {
    const rest = notes.filter((n) => n.id !== id);
    if (rest.length === 0) {
      const fresh: Note = {
        id: Date.now(),
        title: "New Note",
        content: "",
      };
      setNotes([fresh]);
      setActiveNote(fresh.id);
      return;
    }
    setNotes(rest);
    if (activeNote === id) setActiveNote(rest[0].id);
  }

  /* ------------------------------------------------------------------
   * CHAT SESSIONS HANDLERS
   * ------------------------------------------------------------------ */

  function handleNewChat() {
    const id = String(Date.now());
    const session: ChatSession = {
      id,
      title: "New VisuaRealm",
      createdAt: Date.now(),
      updatedAt: Date.now(),
      messageCount: 0,
    };
    setChatSessions((prev) => [session, ...prev]);
    setActiveChatId(id);
    setMessages([]);
  }

  function handleSelectChat(id: string) {
    if (id === activeChatId) return;
    setActiveChatId(id);
    if (typeof window === "undefined") return;
    try {
      const raw = localStorage.getItem(`visuarealm_chat_${id}`);
      if (raw) {
        const parsedMessages = JSON.parse(raw) as Message[];
        setMessages(parsedMessages);
      } else {
        setMessages([]);
      }
    } catch {
      setMessages([]);
    }
  }

  function handleRenameChat(id: string, title: string) {
    setChatSessions((prev) =>
      prev.map((s) => (s.id === id ? { ...s, title } : s))
    );
  }

  function handleDeleteChat(id: string) {
    setChatSessions((prev) => prev.filter((s) => s.id !== id));
    if (typeof window !== "undefined") {
      localStorage.removeItem(`visuarealm_chat_${id}`);
    }
    if (activeChatId === id) {
      const remaining = chatSessions.filter((s) => s.id !== id);
      if (remaining.length) {
        const first = remaining[0];
        setActiveChatId(first.id);
        if (typeof window !== "undefined") {
          const raw = localStorage.getItem(`visuarealm_chat_${first.id}`);
          if (raw) {
            try {
              const parsedMessages = JSON.parse(raw) as Message[];
              setMessages(parsedMessages);
            } catch {
              setMessages([]);
            }
          } else {
            setMessages([]);
          }
        }
      } else {
        const newId = String(Date.now());
        const newSession: ChatSession = {
          id: newId,
          title: "New VisuaRealm",
          createdAt: Date.now(),
          updatedAt: Date.now(),
          messageCount: 0,
        };
        setChatSessions([newSession]);
        setActiveChatId(newId);
        setMessages([]);
      }
    }
  }

  /* ------------------------------------------------------------------
   * RESPONSE SPLITTING
   * ------------------------------------------------------------------ */

  function splitResponse(content: string) {
    const normalized = content.replace(/\r?\n+/g, "\n").trim();

    // If there's code fences or JSON, don't try to split/strip
    if (normalized.includes("```") || normalized.includes("{"))
      return { main: normalized, recap: null, urls: [] as string[] };

    const recapRegex = /(📘 Quick Recap[:\s\S]*?)(?=$|\n{2,}|$)/i;
    const recapMatch = normalized.match(recapRegex);
    const recap = recapMatch ? recapMatch[0].trim() : null;

    const withoutRecap = recap
      ? normalized.replace(recap, "").trim()
      : normalized;

    const urlRegex = /(https?:\/\/[^\s]+)/gi;
    const urls = [...withoutRecap.matchAll(urlRegex)].map((m) => m[0]);

    return {
      main: withoutRecap.replace(urlRegex, "").trim(),
      recap,
      urls,
    };
  }

  /* ------------------------------------------------------------------
   * CHAT SEND HANDLER
   * ------------------------------------------------------------------ */

  async function sendMessage(e: FormEvent) {
    e.preventDefault();
    if (loading) return;
    if (!input.trim() && !file) return;

    const userMessage: Message = {
      role: "user",
      content: input,
      fileUrl: file ? URL.createObjectURL(file) : undefined,
    };

    setMessages((prev) => [...prev, userMessage]);
    setLoading(true);
    setInput("");

    const formData = new FormData();
    formData.append("messages", JSON.stringify([...messages, userMessage]));
    if (file) formData.append("file", file);

    try {
      const res = await fetch("/api/chat", { method: "POST", body: formData });
      const data = await res.json();
      const reply = data.reply || "";

      const { main, recap, urls } = splitResponse(reply);

      if (main)
        setMessages((p) => [...p, { role: "assistant", content: main }]);

      if (recap)
        setMessages((p) => [
          ...p,
          { role: "assistant", content: recap, type: "recap" },
        ]);

      if (urls.length)
        setMessages((p) => [
          ...p,
          {
            role: "assistant",
            content:
              "🔗 Resource Links:\n" +
              urls.map((u) => `- [${u}](${u})`).join("\n"),
            type: "recap",
          },
        ]);
    } catch {
      setMessages((p) => [
        ...p,
        { role: "assistant", content: "⚠️ Could not reach the API." },
      ]);
    } finally {
      setFile(null);
      setLoading(false);
    }
  }

  /* ------------------------------------------------------------------
   * SMART IMPROVE NOTES
   * ------------------------------------------------------------------ */

  async function handleSmartImprove() {
    const note = notes.find((n) => n.id === activeNote);
    if (!note?.content.trim()) {
      alert("Note is empty.");
      return;
    }

    setImproving(true);

    const recentChat = messages
      .slice(-5)
      .map((m) => `${m.role}: ${m.content}`)
      .join("\n");

    const prompt = `
Use this chat context:
${recentChat || "(no prior chat)"}

Improve this note:
${note.content}
`.trim();

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: [{ role: "user", content: prompt }] }),
      });

      const data = await res.json();
      const reply = data.reply || "No response.";

      setNotes((prev) =>
        prev.map((n) =>
          n.id === activeNote ? { ...n, content: reply } : n
        )
      );
    } finally {
      setImproving(false);
    }
  }

  /* ------------------------------------------------------------------
   * UI HELPERS
   * ------------------------------------------------------------------ */

  async function handleCopy(content: string, index: number) {
    try {
      if (navigator?.clipboard?.writeText) {
        await navigator.clipboard.writeText(content);
      } else {
        const textarea = document.createElement("textarea");
        textarea.value = content;
        textarea.style.position = "fixed";
        textarea.style.opacity = "0";
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand("copy");
        document.body.removeChild(textarea);
      }
      setCopiedIndex(index);
      setTimeout(() => setCopiedIndex(null), 1500);
    } catch {
      // ignore
    }
  }

  function handleSuggestionClick(text: string) {
    setInput(text);
    inputRef.current?.focus();
  }

  function handleDisplayNameChange(e: ChangeEvent<HTMLInputElement>) {
    setDisplayName(e.target.value);
  }

  /* ------------------------------------------------------------------
   * MARKDOWN COMPONENTS
   * ------------------------------------------------------------------ */

  const markdownComponents: Components = {
    code({ className, children }) {
      const match = /language-(\w+)/.exec(className || "");
      return match ? (
        <pre className="bg-black/80 max-h-80 overflow-auto p-3 rounded-lg text-[11px] leading-snug text-green-400 shadow-[0_0_10px_rgba(0,255,150,0.3)]">
          <code>{String(children).replace(/\n$/, "")}</code>
        </pre>
      ) : (
        <code className="bg-black/40 text-[11px] text-green-300 px-1.5 py-0.5 rounded">
          {children}
        </code>
      );
    },
  };

  /* ------------------------------------------------------------------
   * RENDER
   * ------------------------------------------------------------------ */

  return (
    <main className="flex flex-col h-screen bg-gradient-to-b from-[#050510] via-[#050308] to-black text-gray-100">
      {/* HEADER */}
      <header className="shrink-0 border-b border-neutral-800 bg-neutral-950/80 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
          {/* Left: Logo + Title */}
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-2xl bg-gradient-to-tr from-cyan-400 via-blue-500 to-purple-600 shadow-[0_0_18px_rgba(56,189,248,0.8)]">
              <span className="text-xs font-extrabold tracking-[0.18em]">
                VR
              </span>
            </div>
            <div className="flex flex-col">
              <span className="text-sm font-semibold tracking-wide">
                VisuaRealm
              </span>
              <span className="text-[11px] text-gray-400">
                Personal AI Studio • Chat, Notes, Flow
              </span>
            </div>
          </div>

          {/* Right: Username + Auth */}
          <div className="flex items-center gap-3">
            {/* Editable display name */}
            <div className="hidden sm:flex flex-col items-end gap-1">
              <label className="text-[10px] uppercase tracking-wide text-gray-400">
                Display Name
              </label>
              <input
                value={displayName}
                maxLength={32}
                onChange={handleDisplayNameChange}
                className="rounded-full border border-neutral-700 bg-neutral-900 px-3 py-1 text-[11px] text-gray-100 outline-none focus:border-blue-500"
                placeholder="How VisuaRealm sees you"
              />
            </div>

            <button
              onClick={() => setShowNotes((v) => !v)}
              className="rounded-full border border-neutral-700 bg-neutral-900 px-3 py-1 text-[11px] text-gray-200 hover:border-blue-500 hover:text-white"
            >
              {showNotes ? "Hide Notes" : "Show Notes"}
            </button>

            {user ? (
              <>
                <span className="hidden text-[11px] text-gray-400 md:inline">
                  Signed in as{" "}
                  <b className="text-gray-200">
                    {user.email || displayName}
                  </b>
                </span>
                <button
                  onClick={async () => {
                    await supabase.auth.signOut();
                    setUser(null);
                  }}
                  className="rounded-full bg-red-500 px-3 py-1 text-[11px] font-medium text-white hover:bg-red-600"
                >
                  Log Out
                </button>
              </>
            ) : (
              <button
                onClick={() => (window.location.href = "/login")}
                className="rounded-full bg-blue-600 px-3 py-1 text-[11px] font-medium text-white hover:bg-blue-500"
              >
                Log In
              </button>
            )}
          </div>
        </div>
      </header>

      {/* NOTES PANEL */}
      {showNotes && (
        <section className="shrink-0 border-b border-neutral-800 bg-neutral-950/90">
          <div className="mx-auto max-w-5xl px-4 py-3">
            <div className="mb-3 flex items-center justify-between gap-3">
              <div>
                <h2 className="text-sm font-semibold tracking-wide">
                  Quick Notes
                </h2>
                <p className="text-[11px] text-gray-400">
                  Saved locally in this browser. Great for todos, prompts, or
                  drafts.
                </p>
              </div>

              <button
                onClick={addNote}
                className="rounded-full bg-emerald-600 px-3 py-1 text-[11px] font-medium text-white hover:bg-emerald-500"
              >
                + Add Note
              </button>
            </div>

            <div className="grid gap-3 md:grid-cols-2">
              {notes.map((note) => (
                <div
                  key={note.id}
                  onClick={() => setActiveNote(note.id)}
                  className={`group relative cursor-pointer rounded-xl border p-3 transition-all ${
                    note.id === activeNote
                      ? "border-blue-500 bg-neutral-900/90 shadow-[0_0_18px_rgba(37,99,235,0.45)]"
                      : "border-neutral-800 bg-neutral-900/70 hover:border-neutral-600 hover:bg-neutral-900"
                  }`}
                >
                  <button
                    className="absolute right-2 top-2 text-xs text-red-400 opacity-60 hover:opacity-100"
                    onClick={(e) => {
                      e.stopPropagation();
                      deleteNote(note.id);
                    }}
                  >
                    ✕
                  </button>

                  <input
                    value={note.title}
                    onChange={(e) =>
                      setNotes((prev) =>
                        prev.map((n) =>
                          n.id === note.id
                            ? { ...n, title: e.target.value }
                            : n
                        )
                      )
                    }
                    className="mb-1 w-full bg-transparent text-sm font-semibold outline-none placeholder:text-gray-500"
                    placeholder="Note title"
                  />

                  <textarea
                    value={note.content}
                    onChange={(e) =>
                      setNotes((prev) =>
                        prev.map((n) =>
                          n.id === note.id
                            ? { ...n, content: e.target.value }
                            : n
                        )
                      )
                    }
                    rows={3}
                    className="w-full resize-none bg-transparent text-xs text-gray-200 outline-none placeholder:text-gray-500"
                    placeholder="Type your note..."
                  />
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* MAIN AREA */}
      <section className="flex-1 flex justify-center overflow-hidden">
        <div className="flex w-full max-w-5xl gap-4 px-4 pt-4 overflow-hidden">
          {/* CHAT LIST SIDEBAR */}
          <aside className="hidden md:flex w-56 flex-col rounded-2xl border border-neutral-800 bg-neutral-950/80 p-3 text-xs shadow-[0_0_30px_rgba(15,23,42,0.9)]">
            <div className="mb-2 flex items-center justify-between">
              <span className="text-[11px] font-semibold uppercase tracking-wide text-gray-300">
                VisuaRealm Sessions
              </span>
              <button
                onClick={handleNewChat}
                className="rounded-full bg-emerald-600 px-2 py-0.5 text-[10px] font-semibold text-white hover:bg-emerald-500"
              >
                + New
              </button>
            </div>
            <div className="flex-1 space-y-1 overflow-y-auto pr-1">
              {chatSessions.map((chat) => {
                const isActive = chat.id === activeChatId;
                return (
                  <div
                    key={chat.id}
                    className={`group rounded-xl border px-2 py-2 cursor-pointer flex flex-col gap-1 transition-all ${
                      isActive
                        ? "border-blue-500/80 bg-blue-950/60"
                        : "border-neutral-800 bg-neutral-900/60 hover:border-neutral-600 hover:bg-neutral-900"
                    }`}
                    onClick={() => handleSelectChat(chat.id)}
                  >
                    <div className="flex items-center gap-1">
                      <input
                        value={chat.title}
                        onChange={(e) =>
                          handleRenameChat(chat.id, e.target.value)
                        }
                        className="flex-1 bg-transparent text-[11px] font-semibold outline-none truncate"
                      />
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteChat(chat.id);
                        }}
                        className="text-[10px] text-red-400 opacity-0 group-hover:opacity-100"
                      >
                        ✕
                      </button>
                    </div>
                    <div className="flex justify-between text-[10px] text-gray-500">
                      <span>{chat.messageCount} msg</span>
                      <span>
                        {new Date(chat.updatedAt).toLocaleTimeString([], {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </span>
                    </div>
                  </div>
                );
              })}
              {chatSessions.length === 0 && (
                <p className="text-[11px] text-gray-500">
                  No sessions yet. Start one.
                </p>
              )}
            </div>
          </aside>

          {/* MAIN CHAT */}
          <div className="flex-1 flex flex-col overflow-hidden">
            <div
              ref={scrollContainerRef}
              className="flex-1 space-y-5 overflow-y-auto rounded-2xl border border-neutral-800 bg-neutral-950/70 px-3 py-4 shadow-[0_0_40px_rgba(15,23,42,0.85)]"
            >
              {messages.length === 0 && (
                <div className="mb-3 rounded-xl border border-dashed border-neutral-700 bg-neutral-900/70 px-4 py-4 text-xs text-gray-400">
                  <p className="mb-1 text-gray-200">
                    Welcome to{" "}
                    <span className="font-semibold">VisuaRealm</span>
                  </p>
                  <p>
                    Ask for code, strategy, design, music, life plans — anything
                    you want this studio to build with you.
                  </p>
                </div>
              )}

              {messages.map((msg, i) => {
                const isUser = msg.role === "user";

                return (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0, y: 5 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.18 }}
                    className={`flex w-full ${
                      isUser ? "justify-end" : "justify-start"
                    }`}
                  >
                    <div
                      className={`relative flex max-w-[88%] gap-2 text-sm ${
                        isUser ? "flex-row-reverse" : "flex-row"
                      }`}
                    >
                      {/* Avatar */}
                      <div className="mt-5 flex flex-col items-center gap-1">
                        {isUser ? (
                          <div className="flex h-7 w-7 items-center justify-center rounded-full border border-neutral-700 bg-neutral-900 text-[10px] font-semibold text-gray-200">
                            {displayName.slice(0, 3)}
                          </div>
                        ) : (
                          <div className="flex h-7 w-7 items-center justify-center rounded-full bg-gradient-to-tr from-cyan-400 via-blue-500 to-purple-600 text-[10px] font-bold shadow-[0_0_16px_rgba(56,189,248,0.6)]">
                            VR
                          </div>
                        )}
                      </div>

                      {/* Bubble */}
                      <div
                        className={`group relative w-full rounded-2xl border px-4 py-3 shadow-md ${
                          isUser
                            ? "ml-auto border-purple-500/70 bg-gradient-to-r from-purple-600 to-blue-600 text-white"
                            : msg.type === "recap"
                            ? "border-blue-400/80 bg-gradient-to-r from-blue-600 to-cyan-500 text-white"
                            : "border-neutral-800 bg-neutral-900 text-gray-200"
                        }`}
                      >
                        <p
                          className={`mb-1 text-[10px] uppercase tracking-wider ${
                            isUser
                              ? "text-gray-200 text-right"
                              : "text-blue-300"
                          }`}
                        >
                          {isUser ? displayName : "VisuaRealm AI"}
                        </p>

                        {/* Copy button */}
                        {!isUser && (
                          <button
                            type="button"
                            onClick={() => handleCopy(msg.content, i)}
                            className="absolute right-2 top-2 rounded-full border border-neutral-600 bg-neutral-900/80 px-2 py-0.5 text-[10px] text-gray-300 opacity-0 transition-opacity group-hover:opacity-100"
                          >
                            {copiedIndex === i ? "Copied" : "Copy"}
                          </button>
                        )}

                        <ReactMarkdown
                          remarkPlugins={[remarkGfm]}
                          components={markdownComponents}
                        >
                          {msg.content}
                        </ReactMarkdown>

                        {msg.fileUrl && (
                          <img
                            src={msg.fileUrl}
                            className="mt-3 max-w-full rounded border border-neutral-700"
                          />
                        )}

                        {/* Suggestions */}
                        {!isUser && (
                          <div className="mt-4 flex flex-wrap gap-2">
                            {[
                              "Explain this more",
                              "Rewrite cleaner",
                              "Give concrete examples",
                              "Turn into code",
                            ].map((suggestion) => (
                              <button
                                key={suggestion}
                                type="button"
                                onClick={() =>
                                  handleSuggestionClick(suggestion)
                                }
                                className="rounded-full border border-neutral-700 bg-neutral-900/90 px-2 py-1 text-[11px] text-gray-200 hover:border-blue-500 hover:text-white"
                              >
                                {suggestion}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  </motion.div>
                );
              })}

              <div ref={chatEndRef} />
            </div>
          </div>
        </div>
      </section>

      {/* SCROLL TO BOTTOM */}
      {showScrollToBottom && (
        <button
          onClick={() =>
            scrollContainerRef.current?.scrollTo({
              top: scrollContainerRef.current.scrollHeight,
              behavior: "smooth",
            })
          }
          className="fixed bottom-[120px] left-6 z-50 rounded-full border border-neutral-700 bg-neutral-950/95 px-3 py-1 text-xs text-gray-200 shadow-lg"
        >
          ↓ Jump to latest
        </button>
      )}

      {/* SMART IMPROVE NOTE */}
      {showNotes && (
        <button
          onClick={handleSmartImprove}
          disabled={improving}
          className="fixed bottom-[120px] right-6 z-40 rounded-full bg-gradient-to-r from-blue-500 to-cyan-500 px-4 py-2 text-xs font-semibold text-white shadow-lg disabled:opacity-60"
        >
          {improving ? "Improving..." : "✨ Smart Improve Note"}
        </button>
      )}

      {/* LOADING INDICATOR */}
      {loading && (
        <div className="fixed bottom-[150px] left-1/2 z-50 -translate-x-1/2 rounded-full border border-neutral-700 bg-neutral-950/95 px-4 py-2 text-xs text-gray-300 shadow-xl flex items-center gap-2">
          <div className="flex gap-1">
            <span className="h-2 w-2 animate-bounce rounded-full bg-blue-400" />
            <span className="h-2 w-2 animate-bounce rounded-full bg-blue-400 delay-150" />
            <span className="h-2 w-2 animate-bounce rounded-full bg-blue-400 delay-300" />
          </div>
          <span>VisuaRealm is thinking...</span>
        </div>
      )}

      {/* BOTTOM NAV DOCK */}
      <nav className="fixed bottom-[80px] left-0 right-0 z-30 flex justify-center pointer-events-none">
        <div className="flex gap-8 px-6 py-3 rounded-3xl border border-neutral-700 bg-[#0c0c18]/90 backdrop-blur-xl shadow-[0_8px_28px_rgba(0,0,0,0.85)] pointer-events-auto">
          {/* VisuaRealm (main chat) */}
          <button
            onClick={() => (window.location.href = "/")}
            className="flex flex-col items-center text-xs text-gray-300 hover:text-white transition"
          >
            <span className="text-xl">💬</span>
            <span className="text-[10px] mt-1">VisuaRealm</span>
          </button>

          {/* Whiteboard */}
          <button
            onClick={() => (window.location.href = "/whiteboard")}
            className="flex flex-col items-center text-xs text-gray-300 hover:text-white transition"
          >
            <span className="text-xl">🧠</span>
            <span className="text-[10px] mt-1">Board</span>
          </button>

          {/* Notepad */}
          <button
            onClick={() => (window.location.href = "/notepad")}
            className="flex flex-col items-center text-xs text-gray-300 hover:text-white transition"
          >
            <span className="text-xl">📓</span>
            <span className="text-[10px] mt-1">Notes</span>
          </button>

          {/* Image / Visual */}
          <button
            onClick={() => (window.location.href = "/image")}
            className="flex flex-col items-center text-xs text-gray-300 hover:text-white transition"
          >
            <span className="text-xl">🖼️</span>
            <span className="text-[10px] mt-1">Images</span>
          </button>
        </div>
      </nav>

      {/* CHAT BAR */}
      <div className="shrink-0 fixed bottom-0 left-0 right-0 z-50 border-t border-neutral-700 bg-[#0d0d16]/90 backdrop-blur-xl shadow-[0_-8px_30px_rgba(0,0,0,0.85)]">
        <div className="mx-auto flex w-full max-w-5xl flex-col gap-2 px-4 py-3">
          {file && filePreviewUrl && (
            <div className="flex items-center gap-3 rounded-lg border border-neutral-700 bg-neutral-900 px-2 py-1">
              <img
                src={filePreviewUrl}
                className="h-8 w-8 rounded object-cover border border-neutral-800"
              />
              <span className="flex-1 truncate text-xs text-gray-200">
                {file.name}
              </span>
              <button
                className="text-xs text-red-400"
                onClick={() => setFile(null)}
              >
                ✕
              </button>
            </div>
          )}

          <form
            onSubmit={sendMessage}
            className="flex items-center gap-2 text-xs"
          >
            <input
              type="file"
              onChange={(e) => setFile(e.target.files?.[0] || null)}
              className="max-w-[150px] cursor-pointer text-[11px] file:mr-2 file:rounded-full file:border-0 file:bg-neutral-800 file:px-2 file:py-1 file:text-[11px] file:text-gray-200"
            />

            <input
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              disabled={loading}
              className="flex-1 rounded-full border border-neutral-700 bg-neutral-900 px-3 py-2 text-xs text-gray-100 outline-none placeholder:text-gray-500 focus:border-blue-500 disabled:opacity-60"
              placeholder="Tell VisuaRealm what to design, code, plan, or explain..."
            />

            <button
              disabled={loading}
              className="rounded-full bg-blue-600 px-4 py-2 text-xs font-semibold text-white disabled:opacity-60 hover:bg-blue-500"
            >
              {loading ? "Sending..." : "Send"}
            </button>
          </form>
        </div>
      </div>
    </main>
  );
}

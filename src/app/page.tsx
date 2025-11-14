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
  createdAt?: number;
}

interface Note {
  id: number;
  title: string;
  content: string;
  editing: boolean;
}

interface ChatSession {
  id: string;
  title: string;
  createdAt: number;
  updatedAt: number;
  messageCount: number;
}

export default function ChatPage() {
  // --- AUTH / USER ---
  const [user, setUser] = useState<any>(null);
  const [displayName, setDisplayName] = useState<string>("");
  const [userTier] = useState<string>("Free"); // temp until Stripe

  // --- CHAT STATE ---
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [filePreviewUrl, setFilePreviewUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [showScrollToBottom, setShowScrollToBottom] = useState(false);

  // --- NOTES STATE ---
  const [notes, setNotes] = useState<Note[]>([
    { id: 1, title: "New Note", content: "", editing: true },
  ]);
  const [activeNote, setActiveNote] = useState(1);
  const [showNotes, setShowNotes] = useState(true);
  const [improving, setImproving] = useState(false);

  // --- CHAT LIST STATE ---
  const [chatSessions, setChatSessions] = useState<ChatSession[]>([]);
  const [activeChatId, setActiveChatId] = useState<string | null>(null);

  // -----------------------
  // AUTH + USERNAME LOGIC
  // -----------------------
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setUser(data?.user || null);
    });
  }, []);

  // Load display name from localStorage or derive from email
  useEffect(() => {
    if (typeof window === "undefined") return;
    const stored = localStorage.getItem("visuarealm_display_name");
    if (stored) {
      setDisplayName(stored);
      return;
    }
    if (user?.email) {
      const base = String(user.email).split("@")[0];
      setDisplayName(base);
    } else {
      setDisplayName("Guest");
    }
  }, [user]);

  // Persist display name locally
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (displayName) {
      localStorage.setItem("visuarealm_display_name", displayName);
    }
  }, [displayName]);

  // -----------------------
  // NOTES PERSISTENCE
  // -----------------------
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

  // Active note content used as AI context
  const activeNoteContent =
    notes.find((n) => n.id === activeNote)?.content?.trim() || "";

  // -----------------------
  // FILE PREVIEW
  // -----------------------
  useEffect(() => {
    if (!file) {
      setFilePreviewUrl(null);
      return;
    }
    const url = URL.createObjectURL(file);
    setFilePreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  // -----------------------
  // CHAT AUTO SCROLL
  // -----------------------
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

  // Close notes with ESC
  useEffect(() => {
    const fn = (e: KeyboardEvent) => {
      if (e.key === "Escape") setShowNotes(false);
    };
    window.addEventListener("keydown", fn);
    return () => window.removeEventListener("keydown", fn);
  }, []);

  // -----------------------
  // CHAT SESSIONS
  // -----------------------
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

      // create a default chat
      const id = String(Date.now());
      const first: ChatSession = {
        id,
        title: "New VisuaRealm Chat",
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
                  s.title === "New Chat" ||
                  s.title === "New VisuaRealm Chat" ||
                  !s.title.trim()
                    ? deriveTitle(messages) || "New VisuaRealm Chat"
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
    if (!firstUser || !firstUser.content.trim()) return "New VisuaRealm Chat";
    const firstLine = firstUser.content.split("\n")[0].trim();
    if (!firstLine) return "New VisuaRealm Chat";
    return firstLine.length > 40 ? firstLine.slice(0, 40) + "..." : firstLine;
  }

  function handleNewChat() {
    const id = String(Date.now());
    const session: ChatSession = {
      id,
      title: "New VisuaRealm Chat",
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
          title: "New VisuaRealm Chat",
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

  // -----------------------
  // NOTES HANDLERS
  // -----------------------
  function addNote() {
    const newNote: Note = {
      id: Date.now(),
      title: "Untitled",
      content: "",
      editing: true,
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
        editing: true,
      };
      setNotes([fresh]);
      setActiveNote(fresh.id);
      return;
    }
    setNotes(rest);
    if (activeNote === id) setActiveNote(rest[0].id);
  }

  function splitResponse(content: string) {
    const normalized = content.replace(/\r?\n+/g, "\n").trim();

    if (normalized.includes("```") || normalized.includes("{"))
      return { main: normalized, recap: null, urls: [] };

    const recapRegex = /(📘 Quick Recap[:\s\S]*?)(?=$|\n{2,}|$)/i;
    const recapMatch = normalized.match(recapRegex);
    const recap = recapMatch ? recapMatch[0].trim() : null;

    const withoutRecap = recap
      ? normalized.replace(recap, "").trim()
      : normalized;

    const urlRegex = /(https?:\/\/[^\s]+)/gi;
    const urls = [...withoutRecap.matchAll(urlRegex)].map((m) => m[0]);

    return { main: withoutRecap.replace(urlRegex, "").trim(), recap, urls };
  }

  // -----------------------
  // CHAT SEND / IMPROVE
  // -----------------------
  async function sendMessage(e: FormEvent) {
    e.preventDefault();
    if (loading) return;
    if (!input.trim() && !file) return;

    // What the user sees in the chat
    const userMessage: Message = {
      role: "user",
      content: input,
      fileUrl: file ? URL.createObjectURL(file) : undefined,
      createdAt: Date.now(),
    };

    // What the API actually receives (notes used as context)
    const composedContent =
      activeNoteContent && input.trim()
        ? `Context from my notes:\n${activeNoteContent}\n\nMain request:\n${input}`
        : activeNoteContent && !input.trim()
        ? `Use this context:\n${activeNoteContent}`
        : input;

    const apiMessagesForSend = [
      ...messages,
      { ...userMessage, content: composedContent },
    ];

    setMessages((prev) => [...prev, userMessage]);
    setLoading(true);
    setInput("");

    const formData = new FormData();
    formData.append("messages", JSON.stringify(apiMessagesForSend));
    if (file) formData.append("file", file);

    try {
      const res = await fetch("/api/chat", { method: "POST", body: formData });
      const data = await res.json();
      const reply = data.reply || "";

      const { main, recap, urls } = splitResponse(reply);

      if (main)
        setMessages((p) => [
          ...p,
          { role: "assistant", content: main, createdAt: Date.now() },
        ]);

      if (recap)
        setMessages((p) => [
          ...p,
          {
            role: "assistant",
            content: recap,
            type: "recap",
            createdAt: Date.now(),
          },
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
            createdAt: Date.now(),
          },
        ]);
    } catch {
      setMessages((p) => [
        ...p,
        {
          role: "assistant",
          content: "⚠️ Could not reach the API.",
          createdAt: Date.now(),
        },
      ]);
    } finally {
      setFile(null);
      setLoading(false);
    }
  }

  async function handleSmartImprove() {
    const note = notes.find((n) => n.id === activeNote);
    if (!note?.content.trim()) return alert("Note is empty.");

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

  function handleNameChange(e: ChangeEvent<HTMLInputElement>) {
    setDisplayName(e.target.value);
  }

  // -----------------------
  // MARKDOWN
  // -----------------------
  const markdownComponents: Components = {
    code({ className, children, ...props }) {
      const match = /language-(\w+)/.exec(className || "");
      return match ? (
        <pre
          className="bg-black/80 max-h-80 overflow-auto p-3 rounded-xl text-[11px] leading-snug text-emerald-300 
                     shadow-[0_0_18px_rgba(16,185,129,0.35)] border border-emerald-500/30"
        >
          <code {...props}>{String(children).replace(/\n$/, "")}</code>
        </pre>
      ) : (
        <code
          className="bg-neutral-900/80 text-[11px] text-emerald-300 px-1.5 py-0.5 rounded
                     border border-emerald-500/30"
          {...props}
        >
          {children}
        </code>
      );
    },
  };

  // -----------------------
  // UI
  // -----------------------
  return (
    <main
      className="flex h-screen flex-col text-gray-100 
                 bg-[radial-gradient(circle_at_top,_#1f2937_0,_#020617_45%,_#000000_100%)]"
    >
      {/* HEADER */}
      <header className="shrink-0 border-b border-white/5 bg-black/40 backdrop-blur-xl">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
          {/* Logo + Brand */}
          <div className="flex items-center gap-3">
            <div
              className="relative flex h-9 w-9 items-center justify-center rounded-2xl 
                         bg-gradient-to-tr from-cyan-400 via-purple-500 to-emerald-400
                         shadow-[0_0_32px_rgba(94,234,212,0.7)]"
            >
              <span className="text-[10px] font-black tracking-[0.18em] text-black">
                VR
              </span>
              <div className="absolute inset-0 rounded-2xl border border-white/10" />
            </div>
            <div className="flex flex-col">
              <span className="text-sm font-semibold tracking-wide">
                VisuaRealm
              </span>
              <span className="text-[11px] text-gray-400">
                Hybrid AI Studio • Chat · Notes · Flow
              </span>
            </div>
          </div>

          {/* Right side: username + auth + tier */}
          <div className="flex items-center gap-3">
            <div className="hidden sm:flex flex-col items-end gap-1">
              <span className="text-[10px] uppercase tracking-[0.18em] text-gray-500">
                CURRENT USER
              </span>
              <div
                className="flex items-center gap-2 rounded-full border border-white/10 
                           bg-white/5 px-2 py-1"
              >
                <input
                  value={displayName}
                  onChange={handleNameChange}
                  className="w-28 bg-transparent text-[11px] font-medium text-gray-100 
                             outline-none placeholder:text-gray-500"
                  placeholder="Your name"
                />
                <span className="rounded-full bg-emerald-500/20 px-2 py-0.5 text-[10px] text-emerald-300">
                  {user ? "Signed In" : "Local"}
                </span>
              </div>
            </div>

            <button
              onClick={() => setShowNotes((v) => !v)}
              className="hidden sm:inline-flex items-center gap-1 rounded-full border border-white/10 
                         bg-white/5 px-3 py-1 text-[11px] text-gray-200 
                         hover:border-cyan-400/70 hover:text-white transition"
            >
              <span>{showNotes ? "Hide Notes" : "Show Notes"}</span>
            </button>

            {/* Tier + Upgrade */}
            <span className="hidden sm:inline rounded-full bg-purple-500/20 border border-purple-400/40 px-2 py-0.5 text-[10px] text-purple-200">
              {userTier} Tier
            </span>
            <button
              onClick={() => (window.location.href = "/upgrade")}
              className="hidden sm:inline rounded-full bg-gradient-to-r from-purple-500 to-cyan-500 px-3 py-1 text-[11px] font-semibold text-black hover:from-purple-400 hover:to-cyan-400"
            >
              Upgrade
            </button>

            {user ? (
              <>
                <span className="hidden text-[11px] text-gray-400 lg:inline">
                  {user.email}
                </span>
                <button
                  onClick={async () => {
                    await supabase.auth.signOut();
                    setUser(null);
                  }}
                  className="rounded-full bg-red-500/90 px-3 py-1 text-[11px] font-medium text-white hover:bg-red-600"
                >
                  Log Out
                </button>
              </>
            ) : (
              <button
                onClick={() => (window.location.href = "/login")}
                className="rounded-full bg-cyan-500 px-3 py-1 text-[11px] font-semibold text-black hover:bg-cyan-400"
              >
                Log In
              </button>
            )}
          </div>
        </div>
      </header>

      {/* NOTES PANEL */}
      {showNotes && (
        <section className="shrink-0 border-b border-white/5 bg-black/50 backdrop-blur-xl">
          <div className="mx-auto max-w-5xl px-4 py-3">
            <div className="mb-3 flex items-center justify-between gap-3">
              <div>
                <h2 className="text-xs font-semibold uppercase tracking-[0.2em] text-gray-300">
                  Live Notes
                </h2>
                <p className="text-[11px] text-gray-500">
                  Stored locally on this device. Perfect for ideas, prompts, and
                  context.
                </p>
              </div>

              <button
                onClick={addNote}
                className="rounded-full bg-emerald-500 px-3 py-1 text-[11px] font-semibold text-black hover:bg-emerald-400"
              >
                + New Note
              </button>
            </div>

            <div className="grid gap-3 md:grid-cols-2">
              {notes.map((note) => (
                <div
                  key={note.id}
                  onClick={() => setActiveNote(note.id)}
                  className={`group relative cursor-pointer rounded-2xl border p-3 transition 
                    ${
                      note.id === activeNote
                        ? "border-cyan-400/80 bg-gradient-to-br from-cyan-900/60 via-slate-900 to-black shadow-[0_0_26px_rgba(34,211,238,0.5)]"
                        : "border-white/10 bg-black/60 hover:border-cyan-400/60 hover:bg-slate-900/80"
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
                    placeholder="Write anything you want VisuaRealm to remember or use..."
                  />
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* AI CONTEXT STRIP */}
      {showNotes && (
        <section className="shrink-0 border-b border-cyan-500/30 bg-black/70 backdrop-blur-xl">
          <div className="mx-auto max-w-5xl px-4 py-2 flex items-center gap-2 text-[11px]">
            <span className="uppercase tracking-[0.2em] text-cyan-300">
              AI Context →
            </span>
            <span className="text-gray-300 truncate">
              {activeNoteContent ||
                "No active note content. Type above to give VisuaRealm extra context for your replies."}
            </span>
          </div>
        </section>
      )}

      {/* MAIN CONTENT */}
      <section className="flex-1 flex justify-center overflow-hidden">
        <div className="flex w-full max-w-5xl gap-4 px-4 pt-4 overflow-hidden">
          {/* CHAT LIST SIDEBAR */}
          <aside
            className="hidden md:flex w-60 flex-col rounded-3xl border border-white/5 
                       bg-black/60 p-3 text-xs shadow-[0_0_40px_rgba(0,0,0,0.9)]
                       backdrop-blur-xl"
          >
            <div className="mb-2 flex items-center justify-between">
              <span className="text-[10px] font-semibold uppercase tracking-[0.2em] text-gray-400">
                Sessions
              </span>
              <button
                onClick={handleNewChat}
                className="rounded-full bg-emerald-500 px-2 py-0.5 text-[10px] font-semibold text-black hover:bg-emerald-400"
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
                    className={`group rounded-2xl border px-2 py-2 cursor-pointer flex flex-col gap-1 transition 
                      ${
                        isActive
                          ? "border-cyan-400/80 bg-gradient-to-r from-cyan-900/70 via-slate-900 to-black"
                          : "border-white/10 bg-black/40 hover:border-cyan-400/60 hover:bg-slate-900/70"
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
                  No chats yet. Start one.
                </p>
              )}
            </div>
          </aside>

          {/* MAIN CHAT AREA */}
          <div className="flex-1 flex flex-col overflow-hidden">
            <div
              ref={scrollContainerRef}
              className="flex-1 space-y-5 overflow-y-auto rounded-3xl border border-white/5 
                         bg-black/50 px-3 py-4 shadow-[0_0_50px_rgba(0,0,0,0.9)]
                         backdrop-blur-xl"
            >
              {messages.length === 0 && (
                <div
                  className="mb-3 rounded-2xl border border-dashed border-white/15 
                             bg-gradient-to-br from-slate-900/80 via-black to-black
                             px-4 py-4 text-xs text-gray-400"
                >
                  <p className="mb-1 text-gray-100 text-sm font-semibold">
                    Welcome to VisuaRealm Studio
                  </p>
                  <p className="mb-1">
                    Ask for code, articles, designs, systems, or life planning.
                  </p>
                  <p className="text-[11px] text-gray-500">
                    Your chats are stored per-session locally for now. Soon:
                    synced history, limits, and tiers.
                  </p>
                </div>
              )}

              {messages.map((msg, i) => {
                const isUser = msg.role === "user";
                const time =
                  msg.createdAt &&
                  new Date(msg.createdAt).toLocaleTimeString([], {
                    hour: "2-digit",
                    minute: "2-digit",
                  });

                return (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0, y: 6 }}
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
                          <div
                            className="flex h-8 w-8 items-center justify-center rounded-2xl 
                                       border border-white/15 bg-black/80 
                                       text-[10px] font-semibold text-gray-200"
                          >
                            {displayName.slice(0, 2).toUpperCase()}
                          </div>
                        ) : (
                          <div
                            className="flex h-8 w-8 items-center justify-center rounded-2xl 
                                       bg-gradient-to-tr from-cyan-400 via-purple-500 to-emerald-400 
                                       text-[10px] font-black text-black 
                                       shadow-[0_0_26px_rgba(94,234,212,0.7)]"
                          >
                            VR
                          </div>
                        )}
                      </div>

                      {/* Bubble */}
                      <div
                        className={`group relative w-full rounded-2xl border px-4 py-3 shadow-md 
                          ${
                            isUser
                              ? "ml-auto border-purple-500/60 bg-gradient-to-r from-purple-700/80 via-indigo-700/80 to-blue-700/80 text-white"
                              : msg.type === "recap"
                              ? "border-cyan-400/80 bg-gradient-to-r from-cyan-700/90 via-sky-700/90 to-emerald-700/90 text-white"
                              : "border-white/10 bg-black/80 text-gray-100"
                          }`}
                      >
                        <div className="mb-1 flex items-center justify-between">
                          <p
                            className={`text-[10px] uppercase tracking-[0.18em] ${
                              isUser ? "text-gray-200" : "text-cyan-300"
                            }`}
                          >
                            {isUser ? displayName || "You" : "VisuaRealm AI"}
                          </p>
                          {time && (
                            <span className="text-[10px] text-gray-400">
                              {time}
                            </span>
                          )}
                        </div>

                        {!isUser && (
                          <button
                            type="button"
                            onClick={() => handleCopy(msg.content, i)}
                            className="absolute right-2 top-2 rounded-full border border-white/20 
                                       bg-black/60 px-2 py-0.5 text-[10px] text-gray-300 
                                       opacity-0 transition-opacity group-hover:opacity-100"
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
                            className="mt-3 max-w-full rounded-lg border border-white/10"
                          />
                        )}

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
                                className="rounded-full border border-white/15 
                                           bg-black/70 px-2 py-1 text-[11px] text-gray-200 
                                           hover:border-cyan-400 hover:text-white"
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
          className="fixed bottom-[120px] left-6 z-40 rounded-full border border-white/10 
                     bg-black/80 px-3 py-1 text-xs text-gray-200 shadow-lg 
                     backdrop-blur-xl hover:border-cyan-400"
        >
          ↓ Jump to latest
        </button>
      )}

      {/* SMART IMPROVE NOTE */}
      {showNotes && (
        <button
          onClick={handleSmartImprove}
          disabled={improving}
          className="fixed bottom-[120px] right-6 z-40 rounded-full 
                     bg-gradient-to-r from-cyan-500 to-emerald-400 
                     px-4 py-2 text-xs font-semibold text-black shadow-lg 
                     disabled:opacity-60 hover:from-cyan-400 hover:to-emerald-300"
        >
          {improving ? "Improving..." : "✨ Smart Improve Note"}
        </button>
      )}

      {/* LOADING INDICATOR */}
      {loading && (
        <div
          className="fixed bottom-[150px] left-1/2 z-40 -translate-x-1/2 rounded-full 
                     border border-white/10 bg-black/90 px-4 py-2 text-xs text-gray-300 
                     shadow-xl flex items-center gap-2 backdrop-blur-xl"
        >
          <div className="flex gap-1">
            <span className="h-2 w-2 animate-bounce rounded-full bg-cyan-400" />
            <span className="h-2 w-2 animate-bounce rounded-full bg-purple-400 delay-150" />
            <span className="h-2 w-2 animate-bounce rounded-full bg-emerald-400 delay-300" />
          </div>
          <span>VisuaRealm is thinking...</span>
        </div>
      )}

      {/* BOTTOM NAVIGATION DOCK */}
      <nav className="fixed bottom-[80px] left-0 right-0 z-30 flex justify-center pointer-events-none">
        <div
          className="flex gap-8 px-6 py-3 rounded-3xl border border-white/10 
                     bg-black/80 backdrop-blur-2xl 
                     shadow-[0_16px_40px_rgba(0,0,0,0.9)] pointer-events-auto"
        >
          <button
            onClick={() => (window.location.href = "/")}
            className="flex flex-col items-center text-xs text-gray-300 hover:text-white transition"
          >
            <span className="text-xl">💠</span>
            <span className="text-[10px] mt-1">VisuaRealm</span>
          </button>

          <button
            onClick={() => (window.location.href = "/whiteboard")}
            className="flex flex-col items-center text-xs text-gray-500 hover:text-gray-200 transition"
          >
            <span className="text-xl">🧠</span>
            <span className="text-[10px] mt-1">Board (soon)</span>
          </button>

          <button
            onClick={() => (window.location.href = "/notepad")}
            className="flex flex-col items-center text-xs text-gray-300 hover:text-white transition"
          >
            <span className="text-xl">📓</span>
            <span className="text-[10px] mt-1">Notes</span>
          </button>

          <button
            onClick={() => (window.location.href = "/image")}
            className="flex flex-col items-center text-xs text-gray-300 hover:text-white transition"
          >
            <span className="text-xl">🖼️</span>
            <span className="text-[10px] mt-1">Images</span>
          </button>
        </div>
      </nav>

      {/* BOTTOM CHAT BAR */}
      <div
        className="shrink-0 fixed bottom-0 left-0 right-0 z-50 
                   border-t border-white/10 
                   bg-black/90 
                   backdrop-blur-2xl 
                   shadow-[0_-18px_40px_rgba(0,0,0,0.95)]"
      >
        <div className="mx-auto flex w-full max-w-5xl flex-col gap-2 px-4 py-3">
          {file && filePreviewUrl && (
            <div className="flex items-center gap-3 rounded-2xl border border-white/10 bg-black/70 px-2 py-1">
              <img
                src={filePreviewUrl}
                className="h-8 w-8 rounded object-cover border border-white/10"
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
              className="max-w-[150px] cursor-pointer text-[11px] 
                         file:mr-2 file:rounded-full file:border-0 
                         file:bg-black/70 file:px-2 file:py-1 
                         file:text-[11px] file:text-gray-200"
            />

            <input
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              disabled={loading}
              className="flex-1 rounded-full border border-white/10 bg-black/80 px-3 py-2 
                         text-xs text-gray-100 outline-none placeholder:text-gray-500 
                         focus:border-cyan-400 disabled:opacity-60"
              placeholder={
                loading
                  ? "VisuaRealm is thinking..."
                  : "Ask VisuaRealm to plan, code, write, design, or explain anything..."
              }
            />

            <button
              disabled={loading}
              className="rounded-full bg-gradient-to-r from-cyan-500 to-purple-500 
                         px-4 py-2 text-xs font-semibold text-black 
                         disabled:opacity-60 hover:from-cyan-400 hover:to-purple-400"
            >
              {loading ? "Sending..." : "Send"}
            </button>
          </form>
        </div>
      </div>
    </main>
  );
}

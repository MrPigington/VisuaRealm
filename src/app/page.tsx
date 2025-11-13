"use client";

import React, { useState, useRef, useEffect, FormEvent } from "react";
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
  editing: boolean;
}

export default function ChatPage() {
  // --- STATE ---
  const [user, setUser] = useState<any>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  const [notes, setNotes] = useState<Note[]>([
    { id: 1, title: "New Note", content: "", editing: true },
  ]);
  const [activeNote, setActiveNote] = useState(1);
  const [showNotes, setShowNotes] = useState(true);
  const [improving, setImproving] = useState(false);

  const [showScrollToBottom, setShowScrollToBottom] = useState(false);
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);
  const [filePreviewUrl, setFilePreviewUrl] = useState<string | null>(null);

  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  // --- AUTH ---
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setUser(data?.user || null);
    });
  }, []);

  // --- LOAD NOTES ---
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
    } catch {}
  }, []);

  // --- SAVE NOTES ---
  useEffect(() => {
    if (typeof window === "undefined") return;
    localStorage.setItem("visuarealm_notes", JSON.stringify(notes));
    localStorage.setItem("visuarealm_active_note", String(activeNote));
  }, [notes, activeNote]);

  // --- FILE PREVIEW ---
  useEffect(() => {
    if (!file) return setFilePreviewUrl(null);
    const url = URL.createObjectURL(file);
    setFilePreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  // --- AUTO SCROLL ---
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // --- SEE IF USER SCROLLED UP ---
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

  // --- ESC CLOSE NOTES ---
  useEffect(() => {
    const fn = (e: KeyboardEvent) => {
      if (e.key === "Escape") setShowNotes(false);
    };
    window.addEventListener("keydown", fn);
    return () => window.removeEventListener("keydown", fn);
  }, []);

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
    } catch {}
  }

  function handleSuggestionClick(text: string) {
    setInput(text);
    inputRef.current?.focus();
  }

  const markdownComponents: Components = {
    code({ className, children }) {
      const match = /language-(\w+)/.exec(className || "");
      return match ? (
        <pre className="bg-black/80 p-3 rounded-lg text-green-400 overflow-x-auto text-sm shadow-[0_0_10px_rgba(0,255,150,0.3)]">
          <code>{String(children).replace(/\n$/, "")}</code>
        </pre>
      ) : (
        <code className="bg-black/40 text-green-300 px-1.5 py-0.5 rounded">
          {children}
        </code>
      );
    },
  };

  // --------------------------
  // UI REBUILD — FIXED LAYOUT
  // --------------------------

  return (
    <main className="flex flex-col h-screen bg-gradient-to-b from-[#050510] via-[#050308] to-black text-gray-100">
      {/* HEADER */}
      <header className="shrink-0 border-b border-neutral-800 bg-neutral-950/80 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
          {/* Logo */}
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-tr from-cyan-400 via-blue-500 to-purple-600 shadow-[0_0_18px_rgba(56,189,248,0.7)]">
              <span className="text-xs font-bold tracking-[0.12em]">VR</span>
            </div>
            <div className="flex flex-col">
              <span className="text-sm font-semibold tracking-wide">
                VisuaRealm Studio
              </span>
              <span className="text-[11px] text-gray-400">
                Chat • Notes • Build Anything
              </span>
            </div>
          </div>

          {/* Auth */}
          <div className="flex items-center gap-3">
            <button
              onClick={() => setShowNotes((v) => !v)}
              className="rounded-full border border-neutral-700 bg-neutral-900 px-3 py-1 text-xs text-gray-200 hover:border-blue-500 hover:text-white"
            >
              {showNotes ? "Hide Notes" : "Show Notes"}
            </button>

            {user ? (
              <>
                <span className="hidden text-[11px] text-gray-400 sm:inline">
                  Signed in as{" "}
                  <b className="text-gray-200">{user.email}</b>
                </span>
                <button
                  onClick={async () => {
                    await supabase.auth.signOut();
                    setUser(null);
                  }}
                  className="rounded-full bg-red-500 px-3 py-1 text-xs font-medium text-white hover:bg-red-600"
                >
                  Log Out
                </button>
              </>
            ) : (
              <button
                onClick={() => (window.location.href = "/login")}
                className="rounded-full bg-blue-600 px-3 py-1 text-xs font-medium text-white hover:bg-blue-500"
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
                  Saved locally in this browser.
                </p>
              </div>

              <button
                onClick={addNote}
                className="rounded-full bg-emerald-600 px-3 py-1 text-xs font-medium text-white hover:bg-emerald-500"
              >
                + Add Note
              </button>
            </div>

            <div className="grid gap-3 md:grid-cols-2">
              {notes.map((note) => (
                <div
                  key={note.id}
                  onClick={() => setActiveNote(note.id)}
                  className={`group relative cursor-pointer rounded-xl border p-3 transition ${
                    note.id === activeNote
                      ? "border-blue-500 bg-neutral-900/90 shadow-[0_0_18px_rgba(37,99,235,0.45)]"
                      : "border-neutral-800 bg-neutral-900/70 hover:border-neutral-600 hover:bg-neutral-850"
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

      {/* CHAT + SCROLL AREA */}
      <section className="flex-1 flex justify-center overflow-hidden">
        <div className="flex w-full max-w-5xl flex-col px-4 pt-4 overflow-hidden">
          <div
            ref={scrollContainerRef}
            className="flex-1 space-y-5 overflow-y-auto rounded-2xl border border-neutral-800 bg-neutral-950/70 px-3 py-4 shadow-[0_0_40px_rgba(15,23,42,0.85)]"
          >
            {messages.length === 0 && (
              <div className="mb-3 rounded-xl border border-dashed border-neutral-700 bg-neutral-900/70 px-4 py-4 text-xs text-gray-400">
                <p className="mb-1 text-gray-200">
                  Welcome to <span className="font-semibold">VisuaRealm</span>
                </p>
                <p>
                  Ask for code, articles, design, explanations — anything.
                </p>
              </div>
            )}

            {/* CHAT MESSAGES */}
            {messages.map((msg, i) => {
              const isUser = msg.role === "user";

              return (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, y: 5 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.2 }}
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
                        <div className="flex h-7 w-7 items-center justify-center rounded-full border border-neutral-700 bg-neutral-900 text-[11px] font-semibold text-gray-200">
                          You
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
                            : "text-blue-400"
                        }`}
                      >
                        {isUser ? "You" : "VisuaRealm AI"}
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

                      <p className="mt-3 text-[10px] text-gray-500 text-right">
                        {new Date().toLocaleTimeString([], {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </p>
                    </div>
                  </div>
                </motion.div>
              );
            })}

            <div ref={chatEndRef} />
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

      {/* SMART IMPROVE */}
      {showNotes && (
        <button
          onClick={handleSmartImprove}
          disabled={improving}
          className="fixed bottom-[120px] right-6 z-50 rounded-full bg-gradient-to-r from-blue-500 to-cyan-500 px-4 py-2 text-xs font-semibold text-white shadow-lg disabled:opacity-60"
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

      {/* BOTTOM NAVIGATION DOCK — EMOJI EDITION */}
      <nav className="fixed bottom-[80px] left-0 right-0 z-40 flex justify-center pointer-events-none">
        <div
          className="flex gap-8 px-6 py-3 rounded-3xl border border-neutral-700 
                     bg-[#0c0c18]/90 backdrop-blur-xl 
                     shadow-[0_8px_28px_rgba(0,0,0,0.85)] pointer-events-auto"
        >
          {/* Home */}
          <button
            onClick={() => (window.location.href = "/")}
            className="flex flex-col items-center text-xs text-gray-300 hover:text-white transition"
          >
            <span className="text-xl">🧭</span>
            <span className="text-[10px] mt-1">Home</span>
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

      {/* FIXED CHAT BAR — PREMIUM VISUAREALM VERSION */}
      <div
        className="shrink-0 fixed bottom-0 left-0 right-0 z-50 
                   border-t border-neutral-700 
                   bg-[#0d0d16]/90 
                   backdrop-blur-xl 
                   shadow-[0_-8px_30px_rgba(0,0,0,0.85)]"
      >
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
              className="flex-1 rounded-full border border-neutral-700 bg-neutral-900 px-3 py-2 text-xs text-gray-100 outline-none placeholder:text-gray-500 focus:border-blue-500"
              placeholder="Ask VisuaRealm to plan, code, write, design, or explain anything..."
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

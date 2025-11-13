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

  // 🔄 copy state
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);

  // Supabase auth
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setUser(data?.user || null);
    });
  }, []);

  // Load notes
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
      // ignore bad localStorage
    }
  }, []);

  // Save notes
  useEffect(() => {
    if (typeof window === "undefined") return;
    localStorage.setItem("visuarealm_notes", JSON.stringify(notes));
    localStorage.setItem("visuarealm_active_note", String(activeNote));
  }, [notes, activeNote]);

  // File preview
  useEffect(() => {
    if (!file) return setFilePreviewUrl(null);
    const url = URL.createObjectURL(file);
    setFilePreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  // Auto scroll on new messages
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Scroll detection
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

  // ESC closes notes
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

  // Improve note
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

  // 🔄 Copy feature for assistant messages
  async function handleCopy(content: string, index: number) {
    try {
      if (navigator?.clipboard?.writeText) {
        await navigator.clipboard.writeText(content);
      } else {
        // fallback
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
      // ignore errors silently
    }
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

  return (
    <main className="flex flex-col min-h-screen bg-[#0d0d0d] text-gray-100">
      {/* Header */}
      <header className="sticky top-0 bg-neutral-900/80 border-b border-neutral-800 px-6 py-3 z-40">
        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowNotes((v) => !v)}
            className="bg-neutral-800 px-3 py-1 rounded"
          >
            {showNotes ? "Hide Notes" : "Show Notes"}
          </button>

          {user ? (
            <>
              <span className="text-xs text-gray-400">
                Signed in as <b>{user.email}</b>
              </span>
              <button
                onClick={async () => {
                  await supabase.auth.signOut();
                  setUser(null);
                }}
                className="bg-red-500 px-3 py-1 rounded text-white"
              >
                Log Out
              </button>
            </>
          ) : (
            <button
              onClick={() => (window.location.href = "/login")}
              className="bg-blue-600 px-3 py-1 rounded text-white"
            >
              Log In
            </button>
          )}
        </div>
      </header>

      {/* Notes Panel */}
      {showNotes && (
        <section className="bg-neutral-900 border-b border-neutral-800 p-4 max-h-[35vh] overflow-y-auto">
          <div className="flex justify-between mb-3">
            <h2 className="font-semibold">Notes</h2>
            <button
              onClick={addNote}
              className="bg-green-600 px-3 py-1 rounded text-sm"
            >
              + Add
            </button>
          </div>

          <div className="space-y-2">
            {notes.map((note) => (
              <div
                key={note.id}
                onClick={() => setActiveNote(note.id)}
                className={`p-3 rounded relative ${
                  note.id === activeNote
                    ? "bg-neutral-800 border border-blue-500"
                    : "bg-neutral-800/50 hover:bg-neutral-700"
                }`}
              >
                <button
                  className="absolute top-2 right-2 text-red-400"
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
                        n.id === note.id ? { ...n, title: e.target.value } : n
                      )
                    )
                  }
                  className="w-full bg-transparent font-semibold mb-2 outline-none"
                />

                <textarea
                  value={note.content}
                  onChange={(e) =>
                    setNotes((prev) =>
                      prev.map((n) =>
                        n.id === note.id ? { ...n, content: e.target.value } : n
                      )
                    )
                  }
                  rows={3}
                  className="w-full bg-transparent outline-none text-sm"
                />
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Chat */}
      <section className="flex-1 flex flex-col items-center pb-[150px]">
        <div
          ref={scrollContainerRef}
          className="w-full max-w-2xl flex-1 overflow-y-auto px-4 py-6 space-y-6"
        >
          {messages.map((msg, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 5 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.25, delay: i * 0.03 }}
            >
              <div
                className={`max-w-[85%] p-4 rounded-2xl text-sm relative group ${
                  msg.role === "user"
                    ? "ml-auto bg-gradient-to-r from-purple-600 to-blue-600 text-white"
                    : msg.type === "recap"
                    ? "bg-gradient-to-r from-blue-600 to-cyan-500 text-white border border-blue-400"
                    : "bg-neutral-900 text-gray-200 border border-neutral-800"
                }`}
              >
                {/* Copy button for assistant messages */}
                {msg.role === "assistant" && (
                  <button
                    type="button"
                    onClick={() => handleCopy(msg.content, i)}
                    className="absolute top-2 right-2 text-[10px] px-2 py-0.5 rounded-full bg-neutral-800/80 border border-neutral-600 text-gray-300 opacity-0 group-hover:opacity-100 transition-opacity"
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
                    className="mt-2 max-w-full rounded border border-neutral-700"
                  />
                )}
              </div>
            </motion.div>
          ))}
          <div ref={chatEndRef} />
        </div>
      </section>

      {/* Scroll to bottom */}
      {showScrollToBottom && (
        <button
          onClick={() =>
            scrollContainerRef.current?.scrollTo({
              top: scrollContainerRef.current.scrollHeight,
              behavior: "smooth",
            })
          }
          className="fixed bottom-[90px] left-6 bg-neutral-900/90 border border-neutral-700 px-3 py-1 rounded-full text-xs z-50"
        >
          ↓ Jump to latest
        </button>
      )}

      {/* Smart Improve */}
      {showNotes && (
        <button
          onClick={handleSmartImprove}
          disabled={improving}
          className="fixed bottom-[90px] right-6 bg-gradient-to-r from-blue-500 to-cyan-500 px-4 py-2 rounded-full text-white shadow-lg disabled:opacity-60 z-50"
        >
          {improving ? "Improving..." : "✨ Smart Improve"}
        </button>
      )}

      {/* Global loading indicator */}
      {loading && (
        <div className="fixed bottom-[120px] left-1/2 -translate-x-1/2 bg-neutral-900/95 border border-neutral-700 px-4 py-2 rounded-full text-xs text-gray-300 shadow-xl z-50 flex items-center gap-2">
          <div className="flex gap-1">
            <span className="w-2 h-2 rounded-full bg-blue-400 animate-bounce" />
            <span className="w-2 h-2 rounded-full bg-blue-400 animate-bounce delay-150" />
            <span className="w-2 h-2 rounded-full bg-blue-400 animate-bounce delay-300" />
          </div>
          <span>VisuaRealm is thinking...</span>
        </div>
      )}

      {/* FIXED CHAT BAR */}
      <div className="fixed bottom-[70px] left-0 right-0 bg-neutral-950 border-t border-neutral-800 z-50">
        <div className="w-full max-w-2xl mx-auto px-4 py-3 space-y-2">
          {file && filePreviewUrl && (
            <div className="flex items-center gap-3 bg-neutral-900 border border-neutral-700 px-2 py-1 rounded">
              <img
                src={filePreviewUrl}
                className="w-8 h-8 rounded object-cover border border-neutral-800"
              />
              <span className="text-xs truncate">{file.name}</span>
              <button
                className="text-red-400 text-xs"
                onClick={() => setFile(null)}
              >
                ✕
              </button>
            </div>
          )}

          <form onSubmit={sendMessage} className="flex items-center gap-2">
            <input
              type="file"
              onChange={(e) => setFile(e.target.files?.[0] || null)}
              className="text-xs max-w-[150px]"
            />

            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              className="flex-1 bg-neutral-900 text-gray-100 p-2 rounded outline-none"
              placeholder="Type a message..."
            />

            <button
              disabled={loading}
              className="bg-blue-600 px-4 py-2 rounded text-white disabled:opacity-60"
            >
              {loading ? "Sending..." : "Send"}
            </button>
          </form>
        </div>
      </div>
    </main>
  );
}

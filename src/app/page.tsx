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

  // 🔽 new: track scroll to show "jump to bottom"
  const [showScrollToBottom, setShowScrollToBottom] = useState(false);
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);

  // 🖼️ new: file preview URL
  const [filePreviewUrl, setFilePreviewUrl] = useState<string | null>(null);

  // 🔐 Check authenticated user (Supabase)
  useEffect(() => {
    const checkUser = async () => {
      const { data } = await supabase.auth.getUser();
      setUser(data?.user || null);
    };
    checkUser();
  }, []);

  // 📝 new: load notes from localStorage on mount
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const stored = window.localStorage.getItem("visuarealm_notes");
      const storedActive = window.localStorage.getItem("visuarealm_active_note");

      if (stored) {
        const parsed = JSON.parse(stored) as Note[];
        if (Array.isArray(parsed) && parsed.length > 0) {
          setNotes(parsed);
          const idNum = storedActive ? Number(storedActive) : parsed[0].id;
          const exists = parsed.some((n) => n.id === idNum);
          setActiveNote(exists ? idNum : parsed[0].id);
        }
      }
    } catch (err) {
      console.error("Error loading notes from localStorage", err);
    }
  }, []);

  // 📝 new: save notes + activeNote to localStorage
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      window.localStorage.setItem("visuarealm_notes", JSON.stringify(notes));
      window.localStorage.setItem("visuarealm_active_note", String(activeNote));
    } catch (err) {
      console.error("Error saving notes to localStorage", err);
    }
  }, [notes, activeNote]);

  // 🧷 new: file preview URL management
  useEffect(() => {
    if (!file) {
      setFilePreviewUrl(null);
      return;
    }
    const url = URL.createObjectURL(file);
    setFilePreviewUrl(url);
    return () => {
      URL.revokeObjectURL(url);
    };
  }, [file]);

  // 🔄 Auto-scroll chat to bottom on new messages
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // ⬇️ new: show / hide "scroll to bottom" button when user scrolls up
  useEffect(() => {
    const el = scrollContainerRef.current;
    if (!el) return;

    const handleScroll = () => {
      const threshold = 120;
      const distanceFromBottom =
        el.scrollHeight - el.scrollTop - el.clientHeight;

      setShowScrollToBottom(distanceFromBottom > threshold);
    };

    el.addEventListener("scroll", handleScroll);
    return () => el.removeEventListener("scroll", handleScroll);
  }, [messages.length]);

  // 🧹 new: ESC closes notes
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setShowNotes(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  async function handleLogout() {
    await supabase.auth.signOut();
    setUser(null);
  }

  function handleNoteChange(id: number, field: keyof Note, value: string) {
    setNotes((prev) =>
      prev.map((n) => (n.id === id ? { ...n, [field]: value } : n))
    );
  }

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
    const remaining = notes.filter((n) => n.id !== id);

    if (remaining.length === 0) {
      const newNote: Note = {
        id: Date.now(),
        title: "New Note",
        content: "",
        editing: true,
      };
      setNotes([newNote]);
      setActiveNote(newNote.id);
      return;
    }

    setNotes(remaining);
    if (activeNote === id) {
      setActiveNote(remaining[0].id);
    }
  }

  // 🧠 Parse response into main + recap + URLs
  function splitResponse(content: string) {
    const normalized = content.replace(/\r?\n+/g, "\n").trim();

    // If it's clearly code / JSON, just return raw
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

    const main = withoutRecap.replace(urlRegex, "").trim();
    return { main, recap, urls };
  }

  // 💬 Send chat message
  async function sendMessage(e: FormEvent) {
    e.preventDefault();
    if (loading) return; // prevent double-send
    if (!input.trim() && !file) return;

    const userMessage: Message = {
      role: "user",
      content: input,
      fileUrl: file ? URL.createObjectURL(file) : undefined,
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setLoading(true);

    const formData = new FormData();
    formData.append("messages", JSON.stringify([...messages, userMessage]));
    if (file) formData.append("file", file);

    try {
      const res = await fetch("/api/chat", { method: "POST", body: formData });
      const data = await res.json();
      const reply = data.reply || "";

      const { main, recap, urls } = splitResponse(reply);

      if (main) {
        setMessages((p) => [...p, { role: "assistant", content: main }]);
      }

      if (recap) {
        setMessages((p) => [
          ...p,
          { role: "assistant", content: recap, type: "recap" },
        ]);
      }

      if (urls.length > 0) {
        const linksText =
          "🔗 Resource Links:\n" +
          urls.map((u) => `- [${u}](${u})`).join("\n");
        setMessages((p) => [
          ...p,
          { role: "assistant", content: linksText, type: "recap" },
        ]);
      }
    } catch (err) {
      console.error(err);
      setMessages((p) => [
        ...p,
        { role: "assistant", content: "⚠️ Error: Could not reach the API." },
      ]);
    } finally {
      setFile(null);
      setLoading(false);
    }
  }

  // 🪄 Smart Improve — uses active note + last 5 chat messages
  async function handleSmartImprove() {
    const note = notes.find((n) => n.id === activeNote);
    if (!note || !note.content.trim()) return alert("Note is empty.");

    setImproving(true);

    const recentChat = messages
      .slice(-5)
      .map((m) => `${m.role}: ${m.content}`)
      .join("\n");

    const contextPrompt = `
Based on this recent chat context:
${recentChat || "(no prior chat context provided)"}

Improve or expand this note intelligently, keeping style and context:
${note.content}
`.trim();

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: [{ role: "user", content: contextPrompt }],
        }),
      });

      const data = await res.json();
      const reply = data.reply || "No response.";

      setNotes((prev) =>
        prev.map((n) => (n.id === activeNote ? { ...n, content: reply } : n))
      );
    } catch (err) {
      console.error(err);
    } finally {
      setImproving(false);
    }
  }

  const markdownComponents: Components = {
    code({ className, children }) {
      const match = /language-(\w+)/.exec(className || "");
      return match ? (
        <pre className="bg-black/80 p-3 rounded-lg overflow-x-auto text-green-400 text-sm my-2">
          <code>{String(children).replace(/\n$/, "")}</code>
        </pre>
      ) : (
        <code className="bg-black/40 text-green-300 px-1.5 py-0.5 rounded-md text-sm">
          {children}
        </code>
      );
    },
  };

  function clearFile() {
    setFile(null);
  }

  function scrollToBottom() {
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollTo({
        top: scrollContainerRef.current.scrollHeight,
        behavior: "smooth",
      });
    } else {
      chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }

  return (
    <main className="flex flex-col min-h-screen bg-[#0d0d0d] text-gray-100 font-sans relative pb-28">
      {/* 🔝 Header */}
      <header className="flex justify-between items-center bg-neutral-900/80 border-b border-neutral-800 px-6 py-3 sticky top-0 z-40">
        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowNotes(!showNotes)}
            className="bg-neutral-800 hover:bg-neutral-700 px-3 py-1 rounded text-sm"
          >
            {showNotes ? "Hide Notes" : "Show Notes"}
          </button>
          {user ? (
            <>
              <span className="text-xs text-gray-400 hidden sm:inline">
                Signed in as <span className="font-medium">{user.email}</span>
              </span>
              <button
                onClick={handleLogout}
                className="bg-red-500 hover:bg-red-600 text-white text-sm px-3 py-1 rounded-md"
              >
                Log Out
              </button>
            </>
          ) : (
            <button
              onClick={() => (window.location.href = "/login")}
              className="bg-blue-600 hover:bg-blue-700 text-white text-sm px-3 py-1 rounded-md"
            >
              Log In
            </button>
          )}
        </div>
      </header>

      {/* 🗒️ Notes Panel */}
      {showNotes && (
        <section className="bg-neutral-900 border-b border-neutral-800 p-4 max-h-[35vh] overflow-y-auto">
          <div className="flex justify-between items-center mb-3">
            <div className="flex items-center gap-2">
              <h2 className="font-semibold text-gray-300">Notes</h2>
              <span className="text-xs text-gray-500">
                ({notes.length} {notes.length === 1 ? "note" : "notes"})
              </span>
            </div>
            <button
              onClick={addNote}
              className="bg-green-600 hover:bg-green-700 text-white px-3 py-1 text-sm rounded"
            >
              + Add
            </button>
          </div>

          <div className="space-y-2">
            {notes.map((note) => (
              <div
                key={note.id}
                className={`p-3 rounded-md relative ${
                  note.id === activeNote
                    ? "bg-neutral-800 border border-blue-500"
                    : "bg-neutral-800/50 hover:bg-neutral-700"
                }`}
              >
                {/* ❌ Delete Note Button */}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    deleteNote(note.id);
                  }}
                  className="absolute top-2 right-2 text-red-400 hover:text-red-500 text-xs"
                >
                  ✕
                </button>

                {/* Click container to activate note */}
                <div onClick={() => setActiveNote(note.id)}>
                  <input
                    type="text"
                    value={note.title}
                    onChange={(e) =>
                      handleNoteChange(note.id, "title", e.target.value)
                    }
                    className="w-full bg-transparent outline-none font-semibold mb-2"
                  />
                  <textarea
                    value={note.content}
                    onChange={(e) =>
                      handleNoteChange(note.id, "content", e.target.value)
                    }
                    rows={3}
                    className="w-full bg-transparent outline-none text-sm"
                  />
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* 💬 Chat Section */}
      <section className="flex-1 flex flex-col items-center">
        <div
          ref={scrollContainerRef}
          className="w-full max-w-2xl flex-1 overflow-y-auto px-4 py-6 space-y-6"
        >
          {messages.map((msg, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3 }}
            >
              <div
                className={`max-w-[85%] p-4 rounded-2xl text-sm shadow-lg ${
                  msg.role === "user"
                    ? "ml-auto bg-gradient-to-r from-purple-600 to-blue-600 text-white"
                    : msg.type === "recap"
                    ? "bg-gradient-to-r from-blue-600 to-cyan-500 border border-blue-400 text-white"
                    : "bg-neutral-900 border border-neutral-800 text-gray-200"
                }`}
              >
                <ReactMarkdown
                  remarkPlugins={[remarkGfm]}
                  components={markdownComponents}
                >
                  {msg.content}
                </ReactMarkdown>
                {msg.fileUrl && (
                  <img
                    src={msg.fileUrl}
                    alt="upload"
                    className="mt-2 max-w-full rounded-md border border-neutral-700"
                  />
                )}
              </div>
            </motion.div>
          ))}
          {loading && (
            <div className="text-gray-500 italic animate-pulse">
              VisuaRealm is thinking...
            </div>
          )}
          <div ref={chatEndRef} />
        </div>
      </section>

      {/* ⬇️ Scroll to Bottom button */}
      {showScrollToBottom && (
        <button
          type="button"
          onClick={scrollToBottom}
          className="fixed bottom-24 left-6 bg-neutral-900/90 border border-neutral-700 text-xs px-3 py-1 rounded-full shadow-lg hover:bg-neutral-800"
        >
          ↓ Jump to latest
        </button>
      )}

      {/* 🪄 Floating Smart Improve Button */}
      {showNotes && (
        <button
          onClick={handleSmartImprove}
          disabled={improving}
          className="fixed bottom-24 right-6 bg-gradient-to-r from-blue-500 to-cyan-500 hover:from-blue-600 hover:to-cyan-600 text-white px-4 py-2 rounded-full shadow-lg text-sm font-semibold disabled:opacity-70 z-30"
        >
          {improving ? "Improving..." : "✨ Smart Improve"}
        </button>
      )}

      {/* 📥 Fixed bottom input bar */}
      <div className="fixed bottom-0 left-0 right-0 bg-neutral-950 border-t border-neutral-800 z-40">
        <div className="w-full max-w-2xl mx-auto px-4 py-3 flex flex-col gap-2">
          {/* File preview + remove */}
          {file && filePreviewUrl && (
            <div className="flex items-center gap-2 bg-neutral-900 border border-neutral-700 rounded-md px-2 py-1">
              {file.type.startsWith("image/") && (
                <img
                  src={filePreviewUrl}
                  alt="preview"
                  className="w-8 h-8 rounded object-cover border border-neutral-700"
                />
              )}
              <span className="text-xs text-gray-300 truncate max-w-[140px]">
                {file.name}
              </span>
              <button
                type="button"
                onClick={clearFile}
                className="text-red-400 hover:text-red-500 text-xs"
              >
                ✕
              </button>
            </div>
          )}

          <form
            onSubmit={sendMessage}
            className="flex items-center gap-2"
          >
            <input
              type="file"
              onChange={(e) => setFile(e.target.files?.[0] || null)}
              className="text-xs text-gray-400 max-w-[160px]"
            />
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Type a message..."
              className="flex-1 bg-neutral-900 text-gray-100 p-2 rounded-md outline-none"
            />
            <button
              type="submit"
              disabled={loading}
              className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md disabled:opacity-60"
            >
              {loading ? "Sending..." : "Send"}
            </button>
          </form>
        </div>
      </div>
    </main>
  );
}

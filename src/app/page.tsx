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

  // 🔐 check user
  useEffect(() => {
    const checkUser = async () => {
      const { data } = await supabase.auth.getUser();
      setUser(data?.user || null);
    };
    checkUser();
  }, []);

  // 🔄 auto-scroll
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

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

  // 🧠 Parse response
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
    const main = withoutRecap.replace(urlRegex, "").trim();
    return { main, recap, urls };
  }

  // 💬 chat send
  async function sendMessage(e: FormEvent) {
    e.preventDefault();
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
      if (main) setMessages((p) => [...p, { role: "assistant", content: main }]);
      if (recap)
        setMessages((p) => [
          ...p,
          { role: "assistant", content: recap, type: "recap" },
        ]);
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

    const recentChat = messages.slice(-5).map((m) => `${m.role}: ${m.content}`).join("\n");
    const contextPrompt = `
Based on this recent chat context:
${recentChat}

Improve or expand this note intelligently, keeping style and context:
${note.content}
`;

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

  return (
    <main className="flex flex-col min-h-screen bg-[#0d0d0d] text-gray-100 font-sans relative">
      {/* 🔝 Header */}
      <header className="flex justify-between items-center bg-neutral-900/80 border-b border-neutral-800 px-6 py-3 sticky top-0 z-50">
        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowNotes(!showNotes)}
            className="bg-neutral-800 hover:bg-neutral-700 px-3 py-1 rounded text-sm"
          >
            {showNotes ? "Hide Notes" : "Show Notes"}
          </button>
          {user ? (
            <button
              onClick={handleLogout}
              className="bg-red-500 hover:bg-red-600 text-white text-sm px-3 py-1 rounded-md"
            >
              Log Out
            </button>
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
            <h2 className="font-semibold text-gray-300">Notes</h2>
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
                className={`p-3 rounded-md cursor-pointer ${
                  note.id === activeNote
                    ? "bg-neutral-800 border border-blue-500"
                    : "bg-neutral-800/50 hover:bg-neutral-700"
                }`}
                onClick={() => setActiveNote(note.id)}
              >
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
            ))}
          </div>
        </section>
      )}

      {/* 💬 Chat Section */}
      <section className="flex-1 flex flex-col items-center justify-between pb-[80px]">
        <div className="w-full max-w-2xl flex-1 overflow-y-auto px-4 py-6 space-y-6">
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

        {/* Input box */}
        <form
          onSubmit={sendMessage}
          className="w-full max-w-2xl flex items-center gap-2 bg-neutral-950 border-t border-neutral-800 px-4 py-3"
        >
          <input
            type="file"
            onChange={(e) => setFile(e.target.files?.[0] || null)}
            className="text-xs text-gray-400"
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
            Send
          </button>
        </form>
      </section>

      {/* 🪄 Floating Smart Improve Button */}
      {showNotes && (
        <button
          onClick={handleSmartImprove}
          disabled={improving}
          className="fixed bottom-20 right-6 bg-gradient-to-r from-blue-500 to-cyan-500 hover:from-blue-600 hover:to-cyan-600 text-white px-4 py-2 rounded-full shadow-lg text-sm font-semibold disabled:opacity-70 z-50"
        >
          {improving ? "Improving..." : "✨ Smart Improve"}
        </button>
      )}
    </main>
  );
}

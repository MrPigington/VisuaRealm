"use client";

import React, { useState, useRef, useEffect, FormEvent, ChangeEvent } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { Components } from "react-markdown";
import ProfileMenu from "@/components/ProfileMenu";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion"; // npm install framer-motion

interface Message {
  role: "user" | "assistant";
  content: string;
  fileUrl?: string;
}

export default function Page() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  // 🧠 Multi-Tab Note System
  const [showNotes, setShowNotes] = useState(false);
  const [notes, setNotes] = useState([{ id: 1, title: "main.js", content: "", type: "Code" }]);
  const [activeId, setActiveId] = useState(1);
  const [noteLoading, setNoteLoading] = useState(false);
  const activeNote = notes.find((n) => n.id === activeId)!;

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // 🧩 Main Send Message Function
  async function sendMessage(e: FormEvent) {
    e.preventDefault();
    if (!input.trim() && !file) return;

    const fileUrl = file ? URL.createObjectURL(file) : undefined;
    const userMessage: Message = {
      role: "user",
      content: input || (file ? "📎 Uploaded an image:" : ""),
      fileUrl,
    };

    const updatedMessages = [...messages, userMessage];
    setMessages(updatedMessages);
    setInput("");
    setLoading(true);

    const formData = new FormData();
    formData.append("messages", JSON.stringify(updatedMessages));
    if (file) formData.append("file", file);

    try {
      const res = await fetch("/api/chat", { method: "POST", body: formData });
      const data = await res.json();

      // 🧠 Split Recap Section if Found
      const reply = data.reply || "";
      const recapMatch = reply.match(/## 🧩 Summary([\s\S]*?)## 🚀 Next Steps|## 🧩 Summary([\s\S]*)$/);
      let mainText = reply;
      let recap = "";

      if (recapMatch) {
        recap = recapMatch[1]?.trim() || recapMatch[2]?.trim() || "";
        mainText = reply.replace(recapMatch[0], "").trim();
      }

      // Add main reply first
      const botMessage: Message = { role: "assistant", content: mainText };
      setMessages((prev) => [...prev, botMessage]);

      // Add recap bubble a moment later
      if (recap) {
        setTimeout(() => {
          setMessages((prev) => [
            ...prev,
            { role: "assistant", content: `📘 Quick Recap:\n${recap}` },
          ]);
        }, 500);
      }
    } catch (err) {
      console.error("API error:", err);
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: "⚠️ Error: Could not reach the API." },
      ]);
    } finally {
      setFile(null);
      setLoading(false);
    }
  }

  // ✨ Multi-Tab Notes Logic
  function addNote() {
    const id = Date.now();
    setNotes([...notes, { id, title: `note-${notes.length + 1}.txt`, content: "", type: "Note" }]);
    setActiveId(id);
  }

  function updateNoteContent(value: string) {
    setNotes(notes.map((n) => (n.id === activeId ? { ...n, content: value } : n)));
  }

  function removeNote(id: number) {
    setNotes(notes.filter((n) => n.id !== id));
    if (activeId === id && notes.length > 1) setActiveId(notes[0].id);
  }

  async function improveNote() {
    const note = notes.find((n) => n.id === activeId);
    if (!note) return;
    setNoteLoading(true);
    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: [{ role: "user", content: note.content }] }),
      });
      const data = await res.json();
      setNotes(notes.map((n) => (n.id === activeId ? { ...n, content: data.reply } : n)));
    } catch (err) {
      console.error(err);
    } finally {
      setNoteLoading(false);
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
    <main className="flex flex-col min-h-screen bg-gradient-to-b from-[#050505] to-[#0d0d0d] text-gray-100 font-sans relative pb-[120px]">
      {/* Profile Button */}
      <div className="absolute top-4 right-4 z-50">
        <ProfileMenu />
      </div>

      {/* Chat Section */}
      <section className="flex-1 flex flex-col items-center justify-between pb-[120px]">
        {/* Messages */}
        <div className="w-full max-w-2xl flex-1 overflow-y-auto px-4 sm:px-6 py-6 space-y-4 scrollbar-thin scrollbar-thumb-neutral-800 scrollbar-track-transparent">
          {messages.map((msg, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3 }}
              className={`max-w-[85%] p-4 rounded-2xl text-sm leading-relaxed break-words shadow-lg transition ${
                msg.role === "user"
                  ? "ml-auto bg-gradient-to-r from-purple-600 to-blue-600 text-white"
                  : msg.content.startsWith("📘 Quick Recap:")
                  ? "bg-gradient-to-r from-cyan-500/30 to-blue-700/30 border border-cyan-400/40 text-blue-100 italic shadow-[0_0_15px_rgba(0,200,255,0.15)]"
                  : "bg-neutral-900 border border-neutral-800 text-gray-200"
              }`}
            >
              <ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownComponents}>
                {msg.content}
              </ReactMarkdown>

              {msg.fileUrl && (
                <img
                  src={msg.fileUrl}
                  alt="Uploaded preview"
                  className="mt-2 rounded-lg max-w-full max-h-64 object-contain border border-neutral-700"
                />
              )}
            </motion.div>
          ))}
          {loading && (
            <div className="text-gray-500 italic animate-pulse">VisuaRealm is thinking...</div>
          )}
          <div ref={chatEndRef} />
        </div>
      </section>

      {/* Fixed Input Bar */}
      <form
        onSubmit={sendMessage}
        className="fixed bottom-[60px] left-0 right-0 flex justify-center bg-neutral-900/95 border-t border-neutral-800 px-4 sm:px-6 py-3 z-40"
      >
        <div className="w-full max-w-2xl flex items-center gap-3 bg-neutral-800 rounded-full px-4 py-2 shadow-lg">
          <div className="relative flex items-center">
            <input
              type="file"
              id="file-upload"
              accept="image/*"
              className="hidden"
              onChange={(e: ChangeEvent<HTMLInputElement>) => setFile(e.target.files?.[0] || null)}
            />
            <label
              htmlFor="file-upload"
              className="cursor-pointer flex items-center justify-center w-9 h-9 rounded-full bg-neutral-700 hover:bg-neutral-600 text-lg text-gray-200 transition"
              title="Upload Image"
            >
              📎
            </label>
          </div>

          {file && (
            <div className="flex items-center gap-2 text-xs text-gray-400 truncate max-w-[140px]">
              <span className="truncate">{file.name}</span>
              <button
                type="button"
                className="text-red-400 hover:text-red-300"
                onClick={() => setFile(null)}
                title="Remove file"
              >
                ✕
              </button>
            </div>
          )}

          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Talk to VisuaRealm..."
            className="flex-1 bg-transparent text-sm sm:text-base text-gray-100 placeholder-gray-500 outline-none"
          />

          <button
            type="submit"
            disabled={loading}
            className="flex items-center justify-center px-4 py-2 rounded-full bg-gradient-to-r from-blue-600 to-purple-600 text-white font-semibold hover:opacity-90 active:scale-95 transition"
          >
            {loading ? "..." : "Send"}
          </button>
        </div>
      </form>

      {/* Multi-Tab Live Notes */}
      <button
        onClick={() => setShowNotes((p) => !p)}
        className="fixed bottom-24 right-4 bg-gradient-to-r from-green-400 to-emerald-600 text-black px-4 py-2 rounded-full font-semibold hover:opacity-90 shadow-lg z-50"
      >
        {showNotes ? "🧠 Close Notes" : "📂 Notes"}
      </button>

      <AnimatePresence>
        {showNotes && (
          <motion.div
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 40 }}
            transition={{ duration: 0.25 }}
            className="fixed bottom-24 right-4 w-[90%] sm:w-[650px] h-[360px] bg-black/90 border border-green-600/50 rounded-xl shadow-[0_0_25px_rgba(0,255,0,0.15)] font-mono text-green-400 flex flex-col z-50"
          >
            <div className="flex items-center bg-black/70 border-b border-green-700/40 overflow-x-auto">
              {notes.map((n) => (
                <div
                  key={n.id}
                  onClick={() => setActiveId(n.id)}
                  className={`px-3 py-1 cursor-pointer whitespace-nowrap ${
                    n.id === activeId ? "bg-green-700/30" : "hover:bg-green-800/20"
                  }`}
                >
                  {n.title}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      removeNote(n.id);
                    }}
                    className="ml-2 text-green-400 hover:text-green-200"
                  >
                    ✕
                  </button>
                </div>
              ))}
              <button onClick={addNote} className="ml-auto px-3 py-1 text-green-400 hover:text-green-200">
                ＋
              </button>
            </div>

            <textarea
              value={activeNote?.content || ""}
              onChange={(e) => updateNoteContent(e.target.value)}
              placeholder="Type code or notes here..."
              className="flex-1 bg-black text-green-400 text-sm p-3 outline-none resize-none"
            />

            <div className="flex justify-end gap-2 p-2 border-t border-green-700/40 bg-black/70">
              <button
                onClick={() => navigator.clipboard.writeText(activeNote?.content || "")}
                className="text-xs bg-green-700/30 hover:bg-green-700/50 text-green-300 px-3 py-1 rounded-md"
              >
                Copy
              </button>
              <button
                onClick={improveNote}
                disabled={noteLoading}
                className="text-xs bg-gradient-to-r from-green-500 to-emerald-600 text-black font-semibold px-3 py-1 rounded-md hover:opacity-90"
              >
                {noteLoading ? "Thinking..." : "Improve"}
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Bottom Navigation */}
      <nav className="fixed bottom-0 left-0 right-0 bg-gradient-to-r from-purple-600 to-blue-600 flex justify-around items-center py-3 shadow-[0_-2px_12px_rgba(0,0,0,0.5)] border-t border-white/10 z-40">
        {[
          { label: "Main", path: "/" },
          { label: "Chat", path: "/chat" },
          { label: "Research", path: "/research" },
          { label: "Notepad", path: "/notepad" },
          { label: "Projects", path: "/projects" },
          { label: "Whiteboard", path: "/whiteboard" },
        ].map((item, i) => (
          <Link
            key={i}
            href={item.path}
            className="flex flex-col items-center justify-center text-white/90 hover:text-white transition w-full"
          >
            <span className="text-lg leading-none mb-1">●</span>
            <span className="text-xs font-medium">{item.label}</span>
          </Link>
        ))}
      </nav>
    </main>
  );
}

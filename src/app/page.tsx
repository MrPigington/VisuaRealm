"use client";

import React, { useState, useRef, useEffect, FormEvent, ChangeEvent } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { Components } from "react-markdown";
import ProfileMenu from "@/components/ProfileMenu";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion"; // <— install if not: npm install framer-motion

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

  // 🧠 Live Note States
  const [showLiveNote, setShowLiveNote] = useState(false);
  const [liveNote, setLiveNote] = useState("");
  const [noteLoading, setNoteLoading] = useState(false);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

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
      const botMessage: Message = { role: "assistant", content: data.reply };
      setMessages((prev) => [...prev, botMessage]);
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

  // 🧩 Improve Live Note with AI
  async function improveLiveNote() {
    if (!liveNote.trim()) return;
    setNoteLoading(true);
    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: [
            ...messages,
            {
              role: "user",
              content: `Enhance or continue my Live Note content:\n${liveNote}`,
            },
          ],
        }),
      });
      const data = await res.json();
      const newContent = data.reply?.replace(/^> \*\*[\s\S]*?\*\*\n\n/, "");
      setLiveNote(newContent || liveNote);
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: "✅ Live Note updated." },
      ]);
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
    <main className="flex flex-col min-h-screen bg-gradient-to-b from-[#050505] to-[#0d0d0d] text-gray-100 font-sans relative pb-24">
      {/* Profile Button */}
      <div className="absolute top-4 right-4 z-50">
        <ProfileMenu />
      </div>

      {/* Chat Section */}
      <section className="flex-1 flex flex-col items-center justify-between pb-24">
        {/* Messages */}
        <div className="w-full max-w-2xl flex-1 overflow-y-auto px-4 sm:px-6 py-6 space-y-4 scrollbar-thin scrollbar-thumb-neutral-800 scrollbar-track-transparent">
          {messages.map((msg, i) => (
            <div
              key={i}
              className={`max-w-[85%] p-4 rounded-2xl text-sm leading-relaxed break-words shadow-lg transition ${
                msg.role === "user"
                  ? "ml-auto bg-gradient-to-r from-purple-600 to-blue-600 text-white"
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
            </div>
          ))}
          {loading && (
            <div className="text-gray-500 italic animate-pulse">VisuaRealm is thinking...</div>
          )}
          <div ref={chatEndRef} />
        </div>

        {/* Input + File Upload */}
        <form
          onSubmit={sendMessage}
          className="w-full bg-neutral-900/90 border-t border-neutral-800 px-4 sm:px-6 py-4 flex justify-center"
        >
          <div className="w-full max-w-2xl flex items-center gap-3 bg-neutral-800 rounded-full px-4 py-2 shadow-lg overflow-visible relative">
            {/* Upload */}
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
      </section>

      {/* 🧠 Live Note Toggle Button */}
      <button
        onClick={() => setShowLiveNote((prev) => !prev)}
        className="fixed bottom-24 right-4 bg-gradient-to-r from-green-500 to-emerald-700 text-black px-4 py-2 rounded-full text-sm font-semibold hover:opacity-90 shadow-lg transition-all z-50"
      >
        {showLiveNote ? "🧠 Close Note" : "📝 Live Note"}
      </button>

      {/* 🟩 Live Note Box */}
      <AnimatePresence>
        {showLiveNote && (
          <motion.div
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 40 }}
            transition={{ duration: 0.25 }}
            className="fixed bottom-24 right-4 w-[90%] sm:w-[600px] h-[300px] rounded-xl bg-black/90 border border-green-500/50 shadow-[0_0_25px_rgba(0,255,0,0.2)] overflow-hidden flex flex-col font-mono z-50"
          >
            <div className="flex justify-between items-center px-3 py-2 bg-black/70 border-b border-green-700/40">
              <span className="text-green-400 text-sm font-semibold">🧠 Live Note Terminal</span>
              <button
                onClick={() => setShowLiveNote(false)}
                className="text-green-400 hover:text-green-200 text-sm"
              >
                ✕
              </button>
            </div>

            <textarea
              value={liveNote}
              onChange={(e) => setLiveNote(e.target.value)}
              placeholder="Type ideas, plans, or code here..."
              className="flex-1 bg-black text-green-400 placeholder-green-700 text-sm p-3 outline-none resize-none overflow-y-auto"
            />

            <div className="flex justify-end gap-3 p-3 border-t border-green-700/40 bg-black/70">
              <button
                onClick={() => navigator.clipboard.writeText(liveNote)}
                className="px-3 py-1.5 text-xs bg-green-700/30 hover:bg-green-700/50 text-green-300 rounded-md transition"
              >
                Copy
              </button>
              <button
                onClick={improveLiveNote}
                disabled={noteLoading}
                className="px-4 py-1.5 text-xs bg-gradient-to-r from-green-500 to-emerald-600 text-black font-semibold rounded-md hover:opacity-90 transition"
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

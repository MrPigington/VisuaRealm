"use client";

import React, { useState, useRef, useEffect, FormEvent, ChangeEvent } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { Components } from "react-markdown";
import ProfileMenu from "@/components/ProfileMenu";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";

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
  const [followUp, setFollowUp] = useState<{ visible: boolean; text: string }>({ visible: false, text: "" });

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // 🧠 Split Recaps
  function splitResponse(content: string) {
    const clean = content.replace(/\r?\n+/g, "\n").trim();
    const recapRegex = /(📘 Quick Recap[:\s\S]*?)(?=\n{2,}|$)/gi;
    const recaps = [...clean.matchAll(recapRegex)].map((m) => m[0].trim());
    const main = clean.replace(recapRegex, "").trim();
    return { main, recaps };
  }

  async function sendMessage(e: FormEvent) {
    e.preventDefault();
    if (!input.trim() && !file) return;

    const fileUrl = file ? URL.createObjectURL(file) : undefined;
    const userMessage: Message = { role: "user", content: input || "📎 Uploaded an image:", fileUrl };
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
      const reply = data.reply || "";
      const { main, recaps } = splitResponse(reply);

      setMessages((prev) => [...prev, { role: "assistant", content: main }]);
      recaps.forEach((r, i) =>
        setTimeout(() => setMessages((prev) => [...prev, { role: "assistant", content: r }]), 400 + i * 300)
      );
    } catch (err) {
      console.error("API error:", err);
      setMessages((prev) => [...prev, { role: "assistant", content: "⚠️ Error: Could not reach the API." }]);
    } finally {
      setFile(null);
      setLoading(false);
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
        <code className="bg-black/40 text-green-300 px-1.5 py-0.5 rounded-md text-sm">{children}</code>
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
        <div className="w-full max-w-2xl flex-1 overflow-y-auto px-4 sm:px-6 py-6 space-y-6 scrollbar-thin scrollbar-thumb-neutral-800 scrollbar-track-transparent">
          {messages.map((msg, i) => (
            <motion.div key={i} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>
              <div
                className={`relative max-w-[85%] p-4 rounded-2xl text-sm leading-relaxed break-words shadow-lg transition ${
                  msg.role === "user"
                    ? "ml-auto bg-gradient-to-r from-purple-600 to-blue-600 text-white"
                    : msg.content.startsWith("📘 Quick Recap")
                    ? "bg-gradient-to-r from-cyan-500/20 to-blue-700/30 border border-cyan-400/40 text-blue-100 italic shadow-[0_0_15px_rgba(0,200,255,0.15)]"
                    : "bg-neutral-900 border border-neutral-800 text-gray-200"
                }`}
              >
                <ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownComponents}>
                  {msg.content}
                </ReactMarkdown>

                {/* 💡 Quick Ask */}
                {msg.role === "assistant" && !msg.content.startsWith("📘 Quick Recap") && (
                  <button
                    onClick={() => setFollowUp({ visible: true, text: msg.content.slice(0, 80) })}
                    className="absolute -bottom-4 right-2 text-xs bg-blue-600/60 hover:bg-blue-700/80 text-white px-2 py-0.5 rounded-md shadow-sm"
                  >
                    💡 Ask
                  </button>
                )}
              </div>
            </motion.div>
          ))}
          {loading && <div className="text-gray-500 italic animate-pulse">VisuaRealm is thinking...</div>}
          <div ref={chatEndRef} />
        </div>
      </section>

      {/* ✏️ Quick Ask Popup */}
      <AnimatePresence>
        {followUp.visible && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            transition={{ duration: 0.2 }}
            className="fixed bottom-[120px] right-4 bg-neutral-900 border border-blue-500/60 rounded-xl p-4 shadow-xl w-[90%] sm:w-[400px] z-50"
          >
            <h4 className="text-blue-300 text-sm mb-2">💬 Ask a follow-up</h4>
            <textarea
              value={input || followUp.text}
              onChange={(e) => setInput(e.target.value)}
              rows={3}
              className="w-full bg-black/50 text-gray-100 p-2 text-sm rounded-md border border-blue-700/40 outline-none"
            />
            <div className="flex justify-end gap-2 mt-2">
              <button
                onClick={() => setFollowUp({ visible: false, text: "" })}
                className="text-xs px-3 py-1 bg-neutral-800 hover:bg-neutral-700 text-gray-300 rounded-md"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  setFollowUp({ visible: false, text: "" });
                  const fakeEvent = { preventDefault: () => {} } as FormEvent;
                  sendMessage(fakeEvent);
                }}
                className="text-xs px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded-md"
              >
                Send
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Input Bar */}
      <form
        onSubmit={sendMessage}
        className="fixed bottom-[60px] left-0 right-0 flex justify-center bg-neutral-900/95 border-t border-neutral-800 px-4 sm:px-6 py-3 z-40"
      >
        <div className="w-full max-w-2xl flex items-center gap-3 bg-neutral-800 rounded-full px-4 py-2 shadow-lg">
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
    </main>
  );
}

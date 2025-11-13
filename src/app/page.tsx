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

export default function ChatPage() {
  const [user, setUser] = useState<Record<string, any> | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const checkUser = async () => {
      const { data } = await supabase.auth.getUser();
      setUser(data?.user || null);
    };
    checkUser();
  }, []);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function handleLogout() {
    await supabase.auth.signOut();
    setUser(null);
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
    const main = withoutRecap.replace(urlRegex, "").trim();
    return { main, recap, urls };
  }

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

  const markdownComponents: Components = {
    code({ className, children }) {
      const match = /language-(\w+)/.exec(className || "");
      if (match) {
        return (
          <pre className="bg-black/80 p-3 rounded-lg overflow-x-auto text-green-400 text-sm my-2">
            <code>{String(children).replace(/\n$/, "")}</code>
          </pre>
        );
      }
      return (
        <code className="bg-black/40 text-green-300 px-1.5 py-0.5 rounded-md text-sm">
          {children}
        </code>
      );
    },
  };

  return (
    <main className="flex flex-col min-h-screen bg-gradient-to-b from-[#050505] to-[#0d0d0d] text-gray-100 font-sans relative">
      {/* 🔝 Header */}
      <header className="flex justify-between items-center bg-neutral-900/80 border-b border-neutral-800 px-6 py-3 sticky top-0 z-50">
        <h1 className="text-lg font-bold">💬 VisuaRealm Chat</h1>
        {user ? (
          <button
            onClick={handleLogout}
            className="bg-red-500 hover:bg-red-600 text-white text-sm px-3 py-1 rounded-md"
          >
            Log Out
          </button>
        ) : (
          <a
            href="/login"
            className="bg-blue-600 hover:bg-blue-700 text-white text-sm px-3 py-1 rounded-md"
          >
            Sign In
          </a>
        )}
      </header>

      {/* 💬 Chat Messages */}
      <section className="flex-1 flex flex-col items-center justify-between overflow-hidden">
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
                    ? "bg-gradient-to-r from-blue-600 to-cyan-500 border border-blue-400 text-white hover:scale-105 transition cursor-pointer"
                    : "bg-neutral-900 border border-neutral-800 text-gray-200"
                }`}
                onClick={() => {
                  if (msg.type === "recap")
                    navigator.clipboard.writeText(msg.content);
                }}
              >
                <ReactMarkdown
                  remarkPlugins={[remarkGfm]}
                  components={markdownComponents}
                >
                  {msg.content}
                </ReactMarkdown>
                {msg.fileUrl && (
                  <img src={msg.fileUrl} className="mt-2 max-w-full rounded-md" />
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

        {/* 💬 Chat Input */}
        <form
          onSubmit={sendMessage}
          className="w-full max-w-2xl flex items-center gap-3 px-4 py-3 border-t border-neutral-800 bg-neutral-950/90"
        >
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Type a message..."
            className="flex-1 bg-neutral-900 border border-neutral-800 text-white rounded-lg px-3 py-2 outline-none focus:ring-1 focus:ring-blue-500"
          />
          <input
            type="file"
            onChange={(e) => setFile(e.target.files?.[0] || null)}
            className="text-sm text-gray-400"
          />
          <button
            type="submit"
            disabled={loading}
            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium disabled:opacity-60"
          >
            {loading ? "..." : "Send"}
          </button>
        </form>
      </section>
    </main>
  );
}

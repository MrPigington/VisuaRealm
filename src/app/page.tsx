"use client";

import React, { useState, useRef, useEffect, FormEvent, ChangeEvent } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { Components } from "react-markdown";
import ProfileMenu from "@/components/ProfileMenu";

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

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function sendMessage(e: FormEvent) {
    e.preventDefault();
    if (!input.trim() && !file) return;

    // Create local preview URL if file exists
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
    <main className="flex min-h-screen bg-gradient-to-b from-[#050505] to-[#0d0d0d] text-gray-100 font-sans relative">
      {/* Sidebar */}
      <aside className="w-20 bg-gradient-to-b from-purple-600 to-blue-600 flex flex-col items-center py-6 space-y-6 shadow-2xl">
        {[...Array(6)].map((_, i) => (
          <div
            key={i}
            className="w-10 h-10 rounded-2xl bg-white/10 flex items-center justify-center hover:bg-white/20 transition"
          >
            <span className="text-xs font-semibold opacity-80">{i + 1}</span>
          </div>
        ))}
      </aside>

      {/* Profile Button */}
      <div className="absolute top-4 right-4 z-50">
        <ProfileMenu />
      </div>

      {/* Chat Section */}
      <section className="flex-1 flex flex-col items-center justify-between">
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

              {/* 🖼 Image Preview */}
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
            {/* 📎 Upload Button */}
            <div className="relative flex items-center">
              <input
                type="file"
                id="file-upload"
                accept="image/*"
                className="hidden"
                onChange={(e: ChangeEvent<HTMLInputElement>) =>
                  setFile(e.target.files?.[0] || null)
                }
              />
              <label
                htmlFor="file-upload"
                className="cursor-pointer flex items-center justify-center w-9 h-9 rounded-full bg-neutral-700 hover:bg-neutral-600 text-lg text-gray-200 transition duration-150"
                title="Upload Image"
              >
                📎
              </label>
            </div>

            {/* File Name */}
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

            {/* Text Input */}
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Talk to VisuaRealm..."
              className="flex-1 bg-transparent text-sm sm:text-base text-gray-100 placeholder-gray-500 outline-none"
            />

            {/* Send Button */}
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
    </main>
  );
}

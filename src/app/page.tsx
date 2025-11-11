"use client";
import { useState, useRef, useEffect } from "react";

export default function HomeBase() {
  const [messages, setMessages] = useState<{ role: string; content: string }[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function sendMessage(e: React.FormEvent) {
    e.preventDefault();
    if (!input.trim()) return;

    const userMessage = { role: "user", content: input };
    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setLoading(true);

    try {
      // ✅ Hit your internal Next.js API route
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: input }),
      });

      const data = await res.json();
      const botMessage = { role: "assistant", content: data.reply || "No response" };

      setMessages((prev) => [...prev, botMessage]);
    } catch (err) {
      console.error(err);
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: "⚠️ Error: Could not reach the API." },
      ]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="flex h-screen bg-[#0a0a0a] text-white font-sans">
      {/* Sidebar */}
      <aside className="w-20 bg-sky-500 flex flex-col items-center py-4 space-y-6 shadow-lg">
        {[...Array(7)].map((_, i) => (
          <div
            key={i}
            className="w-10 h-10 rounded-xl bg-gradient-to-br from-fuchsia-400 to-blue-600 flex items-center justify-center hover:scale-110 transition"
          >
            <img
              src={`https://placehold.co/40x40/ffffff/000000?text=${i + 1}`}
              alt={`icon-${i}`}
              className="w-6 h-6 opacity-90"
            />
          </div>
        ))}
      </aside>

      {/* Main Chat Section */}
      <section className="flex-1 relative flex flex-col">
        {/* Chat Messages */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {messages.map((msg, i) => (
            <div
              key={i}
              className={`max-w-[75%] p-3 rounded-2xl ${
                msg.role === "user"
                  ? "bg-gradient-to-br from-fuchsia-500/70 to-blue-600/70 self-end"
                  : "bg-zinc-900/70 border border-zinc-800 self-start"
              }`}
            >
              {msg.content}
            </div>
          ))}

          {loading && (
            <div className="self-start text-gray-400 italic animate-pulse">
              VisuaRealm is thinking...
            </div>
          )}

          <div ref={chatEndRef} />
        </div>

        {/* Bottom Input Bar */}
        <form
          onSubmit={sendMessage}
          className="absolute bottom-8 flex items-center justify-center w-full"
        >
          <div className="bg-white/90 text-black rounded-full flex items-center px-6 py-3 w-[400px] max-w-[90%] shadow-xl">
            <span className="w-5 h-5 bg-gradient-to-r from-blue-600 to-purple-500 rounded-full mr-3"></span>

            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Talk to VisuaRealm..."
              className="flex-1 bg-transparent outline-none text-sm text-black placeholder:text-gray-500"
            />

            <button
              type="submit"
              disabled={loading}
              className="w-5 h-5 bg-gradient-to-r from-blue-600 to-purple-500 rounded-full ml-3 flex items-center justify-center text-white text-xs"
            >
              ➤
            </button>
          </div>
        </form>
      </section>
    </main>
  );
}

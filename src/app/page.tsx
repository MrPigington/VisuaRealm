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
    <main className="flex min-h-screen bg-gradient-to-b from-[#050505] to-[#0d0d0d] text-gray-100 font-sans">
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

      {/* Main Chat Section */}
      <section className="flex-1 flex flex-col items-center justify-between">
        {/* Chat Scroll Area */}
        <div className="w-full max-w-2xl flex-1 overflow-y-auto px-4 sm:px-6 py-6 space-y-4 scrollbar-thin scrollbar-thumb-neutral-800 scrollbar-track-transparent">
          {messages.map((msg, i) => (
            <div
              key={i}
              className={`max-w-[80%] p-3 rounded-2xl text-sm leading-relaxed whitespace-pre-wrap break-words ${
                msg.role === "user"
                  ? "ml-auto bg-gradient-to-r from-purple-600 to-blue-600 text-white"
                  : "bg-neutral-900 border border-neutral-800 text-gray-200"
              }`}
            >
              {/* Format GPT responses */}
              {msg.content.split("\n").map((line, index) => {
                // Code block detection
                if (line.trim().startsWith("```")) {
                  const codeLines = [];
                  let j = index + 1;
                  const lines = msg.content.split("\n");
                  while (j < lines.length && !lines[j].trim().startsWith("```")) {
                    codeLines.push(lines[j]);
                    j++;
                  }
                  return (
                    <pre
                      key={index}
                      className="bg-black/60 text-green-400 p-3 my-2 rounded-xl overflow-x-auto text-xs sm:text-sm"
                    >
                      {codeLines.join("\n")}
                    </pre>
                  );
                }

                // Bullet points
                if (line.trim().startsWith("- ") || line.trim().startsWith("* ")) {
                  return (
                    <li key={index} className="ml-5 list-disc">
                      {line.replace(/^[-*]\s*/, "")}
                    </li>
                  );
                }

                // Normal text
                return (
                  <p key={index} className="mb-1">
                    {line}
                  </p>
                );
              })}
            </div>
          ))}

          {loading && (
            <div className="text-gray-500 italic animate-pulse">
              VisuaRealm is thinking...
            </div>
          )}

          <div ref={chatEndRef} />
        </div>

        {/* Input Area */}
        <form
          onSubmit={sendMessage}
          className="w-full bg-neutral-900/90 border-t border-neutral-800 px-4 sm:px-6 py-4 flex justify-center"
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
              className="px-4 py-2 rounded-full bg-gradient-to-r from-blue-600 to-purple-600 text-white font-semibold hover:opacity-90 active:scale-95 transition"
            >
              Send
            </button>
          </div>
        </form>
      </section>
    </main>
  );
}

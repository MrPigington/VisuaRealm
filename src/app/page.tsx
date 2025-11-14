"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { createClient } from "@supabase/supabase-js";

// --------------------------------------------------
// Supabase client (browser safe because anon key only)
// --------------------------------------------------
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export default function MainChat() {
  const [messages, setMessages] = useState<any[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [user, setUser] = useState<any>(null);
  const [tier, setTier] = useState("Free");

  const chatEndRef = useRef<HTMLDivElement>(null);

  // ---------------------------------------
  // Scroll to bottom always
  // ---------------------------------------
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // ---------------------------------------
  // Load user session + tier
  // ---------------------------------------
  useEffect(() => {
    const init = async () => {
      const { data } = await supabase.auth.getUser();
      if (data?.user) {
        setUser(data.user);

        // fetch tier
        const { data: profile } = await supabase
          .from("profiles")
          .select("tier")
          .eq("id", data.user.id)
          .single();

        if (profile?.tier) setTier(profile.tier);
      }
    };
    init();
  }, []);

  // ---------------------------------------
  // Load local messages for guests
  // ---------------------------------------
  useEffect(() => {
    if (!user) {
      const saved = localStorage.getItem("vr_guest_chat");
      if (saved) setMessages(JSON.parse(saved));
    }
  }, [user]);

  // ---------------------------------------
  // Save local for guests
  // ---------------------------------------
  useEffect(() => {
    if (!user) {
      localStorage.setItem("vr_guest_chat", JSON.stringify(messages));
    }
  }, [messages, user]);

  // ---------------------------------------
  // Send GPT message
  // ---------------------------------------
  async function sendMessage(e: any) {
    e.preventDefault();
    if (!input.trim()) return;

    const newMsg = { role: "user", content: input };
    setMessages((prev) => [...prev, newMsg]);

    const current = input;
    setInput("");
    setLoading(true);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: current }),
      });

      const data = await res.json();
      const botMsg = { role: "assistant", content: data.output };

      setMessages((p) => [...p, botMsg]);

      // save to supabase if logged in
      if (user) {
        await supabase.from("chats").insert({
          user_id: user.id,
          messages: [...messages, newMsg, botMsg],
        });
      }
    } catch (err) {
      console.log("Error:", err);
    }

    setLoading(false);
  }

  // -------------------------------------------------
  // UI
  // -------------------------------------------------
  return (
    <div className="min-h-screen flex flex-col bg-[#0d0d0d] text-white">

      {/* HEADER BAR */}
      <div className="w-full bg-[#111] border-b border-white/10 px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          {/* VR ICON editable later */}
          <div className="w-8 h-8 bg-gradient-to-br from-purple-600 to-blue-600 rounded-lg"></div>

          <div className="text-lg font-semibold">VisuaRealm</div>
        </div>

        {/* USER BOX */}
        <div className="flex items-center gap-3">

          {/* Tier badge */}
          <div className="px-3 py-1 rounded-lg bg-purple-700/40 border border-purple-500/40 text-sm">
            {tier}
          </div>

          {/* Upgrade */}
          <button
            onClick={() => alert("Upgrade portal coming soon")}
            className="px-3 py-1 rounded-lg bg-purple-600 hover:bg-purple-500 text-sm"
          >
            Upgrade
          </button>

          {/* Support */}
          <button
            onClick={() => alert("Support coming soon")}
            className="px-3 py-1 rounded-lg bg-blue-600 hover:bg-blue-500 text-sm"
          >
            Support
          </button>

          {/* Delete account */}
          <button
            onClick={() => alert("Delete account coming soon")}
            className="px-3 py-1 rounded-lg bg-red-600 hover:bg-red-500 text-sm"
          >
            Delete
          </button>
        </div>
      </div>

      {/* NAV BAR */}
      <div className="w-full bg-[#111] border-b border-white/5 px-4 py-2 flex gap-4 text-sm">
        <Link href="/"><span className="hover:text-purple-400">Chat</span></Link>
        <Link href="/chats"><span className="hover:text-purple-400">Chats</span></Link>
        <Link href="/codegen"><span className="hover:text-purple-400">CodeGen</span></Link>
        <Link href="/image"><span className="hover:text-purple-400">ImageGen</span></Link>
        <Link href="/whiteboard"><span className="hover:text-purple-400">Whiteboard</span></Link>
        <Link href="/notepad"><span className="hover:text-purple-400">Notes</span></Link>
      </div>

      {/* CHAT AREA */}
      <div className="flex-1 overflow-y-auto px-6 py-6">
        {messages.map((m, idx) => (
          <div key={idx} className="mb-4">
            <div className="text-purple-400 text-sm">{m.role}</div>
            <div className="bg-white/5 p-3 rounded-lg border border-white/10">
              {m.content}
            </div>
          </div>
        ))}

        <div ref={chatEndRef} />
      </div>

      {/* INPUT BAR */}
      <form
        onSubmit={sendMessage}
        className="p-4 border-t border-white/10 flex gap-3 bg-[#111]"
      >
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          className="flex-1 px-4 py-2 rounded-lg bg-black/40 border border-white/10 outline-none"
          placeholder="Ask anything..."
        />

        <button
          type="submit"
          disabled={loading}
          className="px-6 py-2 rounded-lg bg-purple-600 hover:bg-purple-500"
        >
          {loading ? "Thinking…" : "Send"}
        </button>
      </form>
    </div>
  );
}

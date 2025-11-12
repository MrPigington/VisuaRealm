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
  type?: "recap";
  fileUrl?: string;
}

interface Note {
  id: number;
  title: string;
  content: string;
  editing: boolean;
}

export default function Page() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  const [showNotes, setShowNotes] = useState(false);
  const [notes, setNotes] = useState<Note[]>([{ id: 1, title: "main.js", content: "", editing: false }]);
  const [activeId, setActiveId] = useState(1);
  const [noteLoading, setNoteLoading] = useState(false);
  const activeNote = notes.find(n => n.id === activeId)!;

  useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);

  // --- Response parsing with single Quick Recap ---
  function splitResponse(content: string) {
    const normalized = content.replace(/\r?\n+/g, "\n").trim();
    if (normalized.includes("```") || normalized.includes("{")) return { main: normalized, recap: null, urls: [] };

    const recapRegex = /(📘 Quick Recap[:\s\S]*?)(?=$|\n{2,}|$)/i;
    const recapMatch = normalized.match(recapRegex);
    const recap = recapMatch ? recapMatch[0].trim() : null;
    const withoutRecap = recap ? normalized.replace(recap, "").trim() : normalized;

    const urlRegex = /(https?:\/\/[^\s]+)/gi;
    const urls = [...withoutRecap.matchAll(urlRegex)].map(m => m[0]);
    const main = withoutRecap.replace(urlRegex, "").trim();

    return { main, recap, urls };
  }

  // --- Send message ---
  async function sendMessage(e: FormEvent) {
    e.preventDefault();
    if (!input.trim() && !file) return;

    const userMessage: Message = { role: "user", content: input, fileUrl: file ? URL.createObjectURL(file) : undefined };
    setMessages(prev => [...prev, userMessage]);
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

      // Add main message
      if (main) setMessages(prev => [...prev, { role: "assistant", content: main }]);

      // Interactive Quick Recap bubble
      if (recap) {
        setMessages(prev => [...prev, { role: "assistant", content: recap, type: "recap" }]);
      }

      // Resource links bubble
      if (urls.length > 0) {
        const linksText = "🔗 Resource Links:\n" + urls.map(u => `- [${u}](${u})`).join("\n");
        setMessages(prev => [...prev, { role: "assistant", content: linksText, type: "recap" }]);
      }
    } catch (err) {
      console.error(err);
      setMessages(prev => [...prev, { role: "assistant", content: "⚠️ Error: Could not reach the API." }]);
    } finally {
      setFile(null);
      setLoading(false);
    }
  }

  // --- Notes logic ---
  function addNote() {
    const id = Date.now();
    setNotes([...notes, { id, title: `note-${notes.length + 1}.txt`, content: "", editing: false }]);
    setActiveId(id);
  }
  function updateNoteContent(value: string) { setNotes(notes.map(n => (n.id === activeId ? { ...n, content: value } : n))); }
  function renameNote(id: number, newTitle: string) { setNotes(notes.map(n => (n.id === activeId ? { ...n, title: newTitle, editing: false } : n))); }
  function removeNote(id: number) { setNotes(notes.filter(n => n.id !== id)); if (activeId === id && notes.length > 1) setActiveId(notes[0].id); }
  async function improveNote() {
    const note = notes.find(n => n.id === activeId);
    if (!note) return;
    setNoteLoading(true);
    try {
      const res = await fetch("/api/chat", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ messages: [{ role: "user", content: note.content }] }) });
      const data = await res.json();
      setNotes(notes.map(n => (n.id === activeId ? { ...n, content: data.reply } : n)));
    } catch (err) { console.error(err); } finally { setNoteLoading(false); }
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
    }
  };

  return (
    <main className="flex flex-col min-h-screen bg-gradient-to-b from-[#050505] to-[#0d0d0d] text-gray-100 font-sans relative pb-[120px]">
      <div className="absolute top-4 right-4 z-50"><ProfileMenu /></div>

      {/* Chat Section */}
      <section className="flex-1 flex flex-col items-center justify-between pb-[120px]">
        <div className="w-full max-w-2xl flex-1 overflow-y-auto px-4 py-6 space-y-6">
          {messages.map((msg, i) => (
            <motion.div key={i} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>
              <div
                className={`max-w-[85%] p-4 rounded-2xl text-sm shadow-lg ${
                  msg.role === "user"
                    ? "ml-auto bg-gradient-to-r from-purple-600 to-blue-600 text-white"
                    : msg.type === "recap"
                    ? "bg-gradient-to-r from-blue-600 to-cyan-500 border border-blue-400 text-white hover:scale-105 transition cursor-pointer"
                    : "bg-neutral-900 border border-neutral-800 text-gray-200"
                }`}
                onClick={() => { if(msg.type === "recap") navigator.clipboard.writeText(msg.content) }}
              >
                <ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownComponents}>{msg.content}</ReactMarkdown>
                {msg.fileUrl && <img src={msg.fileUrl} className="mt-2 max-w-full rounded-md" />}
              </div>
            </motion.div>
          ))}
          {loading && <div className="text-gray-500 italic animate-pulse">VisuaRealm is thinking...</div>}
          <div ref={chatEndRef} />
        </div>
      </section>

      {/* Input & image preview */}
      <form onSubmit={sendMessage} className="fixed bottom-[60px] left-0 right-0 flex justify-center bg-neutral-900/95 border-t border-neutral-800 px-4 py-3 z-40">
        <div className="w-full max-w-2xl flex flex-col gap-2">
          {file && (
            <div className="relative w-32 h-32">
              <img src={URL.createObjectURL(file)} alt="preview" className="w-full h-full object-cover rounded-md" />
              <button type="button" onClick={() => setFile(null)} className="absolute top-1 right-1 bg-red-500/70 text-white rounded-full w-6 h-6 flex items-center justify-center text-xs hover:bg-red-600">×</button>
            </div>
          )}
          <div className="flex items-center gap-3 bg-neutral-800 rounded-full px-4 py-2 shadow-lg">
            <label htmlFor="file-upload" className="cursor-pointer w-9 h-9 flex items-center justify-center rounded-full bg-neutral-700 hover:bg-neutral-600 text-lg text-gray-200">📎</label>
            <input id="file-upload" type="file" accept="image/*" className="hidden" onChange={(e: ChangeEvent<HTMLInputElement>) => setFile(e.target.files?.[0] || null)} />
            <input type="text" value={input} onChange={(e) => setInput(e.target.value)} placeholder="Talk to VisuaRealm..." className="flex-1 bg-transparent text-sm text-gray-100 placeholder-gray-500 outline-none" />
            <button type="submit" disabled={loading} className="px-4 py-2 rounded-full bg-gradient-to-r from-blue-600 to-purple-600 text-white font-semibold hover:opacity-90 active:scale-95 transition">{loading ? "..." : "Send"}</button>
          </div>
        </div>
      </form>

      {/* Notes Toggle & Panel */}
      <button onClick={() => setShowNotes(p => !p)} className="fixed bottom-6 right-4 z-[999] bg-gradient-to-r from-green-400 to-emerald-600 text-black px-4 py-2 rounded-full font-semibold hover:opacity-90 shadow-lg">
        {showNotes ? "🧠 Close Notes" : "📂 Notes"}
      </button>
      <AnimatePresence>
        {showNotes && (
          <motion.div initial={{ opacity: 0, y: 40 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 40 }} transition={{ duration: 0.25 }}
            className="fixed bottom-20 right-4 w-[90%] sm:w-[650px] h-[360px] bg-black/90 border border-green-600/50 rounded-xl shadow-lg font-mono text-green-400 flex flex-col z-50">
            <div className="flex-1 flex flex-col">
              <div className="flex items-center overflow-x-auto bg-black/70 border-b border-green-700/40">
                {notes.map(n => (
                  <div key={n.id} onClick={() => setActiveId(n.id)} className={`flex items-center px-3 py-1 cursor-pointer ${n.id === activeId ? "bg-green-700/30" : "hover:bg-green-800/20"}`}>
                    {n.editing ? (
                      <input autoFocus type="text" defaultValue={n.title} onBlur={e => renameNote(n.id, e.target.value || n.title)} onKeyDown={e => e.key === "Enter" && renameNote(n.id, (e.target as HTMLInputElement).value || n.title)} className="bg-transparent border-b border-green-400 text-green-200 text-xs outline-none"/>
                    ) : (
                      <span onDoubleClick={() => setNotes(notes.map(x => x.id === n.id ? {...x, editing:true} : x))}>{n.title}</span>
                    )}
                    <button onClick={e => { e.stopPropagation(); removeNote(n.id); }} className="ml-2 text-green-400 hover:text-green-200">✕</button>
                  </div>
                ))}
                <button onClick={addNote} className="ml-auto px-3 py-1 text-green-400 hover:text-green-200">＋</button>
              </div>
              <textarea value={activeNote?.content || ""} onChange={e => updateNoteContent(e.target.value)} placeholder="Type code or notes here..." className="flex-1 bg-black text-green-400 text-sm p-3 outline-none resize-none"/>
              <div className="flex justify-end gap-2 p-2 border-t border-green-700/40 bg-black/70">
                <button onClick={() => navigator.clipboard.writeText(activeNote?.content || "")} className="text-xs bg-green-700/30 hover:bg-green-700/50 text-green-300 px-3 py-1 rounded-md">Copy</button>
                <button onClick={improveNote} disabled={noteLoading} className="text-xs bg-gradient-to-r from-green-500 to-emerald-600 text-black font-semibold px-3 py-1 rounded-md hover:opacity-90">{noteLoading ? "Thinking..." : "Improve"}</button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Bottom Nav */}
      <nav className="fixed bottom-0 left-0 right-0 bg-gradient-to-r from-purple-600 to-blue-600 flex justify-around items-center py-3 shadow-lg border-t border-white/10 z-40">
        {[{ label: "Main", path: "/" }, { label: "Chat", path: "/chat" }, { label: "Research", path: "/research" }, { label: "Notepad", path: "/notepad" }, { label: "Projects", path: "/projects" }, { label: "Whiteboard", path: "/whiteboard" }].map((item, i) => (
          <Link key={i} href={item.path} className="flex flex-col items-center text-white/90 hover:text-white transition w-full">
            <span className="text-lg leading-none mb-1">●</span>
            <span className="text-xs font-medium">{item.label}</span>
          </Link>
        ))}
      </nav>
    </main>
  );
}

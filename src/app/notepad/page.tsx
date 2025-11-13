"use client";

import { useState, useEffect, useRef, FormEvent } from "react";
import { motion } from "framer-motion";

/* ---------------------------------- TYPES ---------------------------------- */

interface Note {
  id: number;
  title: string;
  content: string;
  pinned: boolean;
  favorite: boolean;
  done: boolean;
  updated: number;
  folderId?: string;
}

interface Folder {
  id: string;
  name: string;
  emoji: string;
  builtIn?: boolean;
}

const STORAGE_KEY_V2 = "vr_notepad_v2";
const LEGACY_STORAGE_KEY = "vr_notepad";

type SystemFolderId = "all" | "favorites" | "pinned" | "done" | "inbox";
type AiMode = "free" | "improve" | "summarize" | "tasks" | "rewrite";

/* -------------------------------- MAIN PAGE -------------------------------- */

export default function NotepadPage() {
  const [notes, setNotes] = useState<Note[]>([]);
  const [folders, setFolders] = useState<Folder[]>([]);
  const [activeFolderId, setActiveFolderId] =
    useState<SystemFolderId | string>("all");

  const [search, setSearch] = useState("");
  const [sort, setSort] =
    useState<"updated-desc" | "updated-asc" | "title">("updated-desc");

  const [activeNote, setActiveNote] = useState<number | null>(null);

  /* ------------------------------ AI STATE ------------------------------ */

  const [aiMode, setAiMode] = useState<AiMode>("free");
  const [aiInput, setAiInput] = useState("");
  const [aiLoading, setAiLoading] = useState(false);
  const aiInputRef = useRef<HTMLInputElement | null>(null);

  /* -------------------------- LOAD LOCALSTORAGE -------------------------- */

  useEffect(() => {
    try {
      const storedV2 = localStorage.getItem(STORAGE_KEY_V2);

      if (storedV2) {
        const parsed = JSON.parse(storedV2);
        setNotes(parsed.notes || []);
        setFolders(
          parsed.folders?.length ? parsed.folders : getDefaultFolders()
        );
        return;
      }

      const legacy = localStorage.getItem(LEGACY_STORAGE_KEY);
      if (legacy) {
        const migrated = JSON.parse(legacy).map((n: any) => ({
          ...n,
          folderId: n.folderId ?? "inbox",
        }));
        setNotes(migrated);
        setFolders(getDefaultFolders());
      } else {
        setNotes([]);
        setFolders(getDefaultFolders());
      }
    } catch {
      setNotes([]);
      setFolders(getDefaultFolders());
    }
  }, []);

  /* --------------------------- SAVE LOCALSTORAGE -------------------------- */

  useEffect(() => {
    localStorage.setItem(
      STORAGE_KEY_V2,
      JSON.stringify({ notes, folders })
    );
  }, [notes, folders]);

  /* ----------------------------- DEFAULT FOLDERS ----------------------------- */

  function getDefaultFolders(): Folder[] {
    return [
      { id: "inbox", name: "Inbox", emoji: "📥", builtIn: true },
      { id: "work", name: "Work", emoji: "💼", builtIn: true },
      { id: "ideas", name: "Ideas", emoji: "🧠", builtIn: true },
      { id: "personal", name: "Personal", emoji: "🌙", builtIn: true },
      { id: "archive", name: "Archive", emoji: "🗂️", builtIn: true },
    ];
  }

  function currentFolderLabel() {
    if (activeFolderId === "all") return "All Notes";
    if (activeFolderId === "favorites") return "Favorites";
    if (activeFolderId === "pinned") return "Pinned";
    if (activeFolderId === "done") return "Done";
    return folders.find((f) => f.id === activeFolderId)?.name || "Notes";
  }

  /* ----------------------------- CRUD LOGIC ------------------------------ */

  function addNote() {
    const id = Date.now();

    const folder =
      activeFolderId === "all" ||
      activeFolderId === "favorites" ||
      activeFolderId === "pinned" ||
      activeFolderId === "done"
        ? "inbox"
        : activeFolderId;

    const newNote: Note = {
      id,
      title: "Untitled Note",
      content: "",
      pinned: false,
      favorite: false,
      done: false,
      updated: Date.now(),
      folderId: folder,
    };

    setNotes((prev) => [newNote, ...prev]);
    setActiveNote(id);
  }

  function updateNote(id: number, fields: Partial<Note>) {
    setNotes((prev) =>
      prev.map((n) =>
        n.id === id ? { ...n, ...fields, updated: Date.now() } : n
      )
    );
  }

  function deleteNote(id: number) {
    setNotes((prev) => prev.filter((n) => n.id !== id));
    if (activeNote === id) setActiveNote(null);
  }

  function addFolder() {
    const name = window.prompt("Folder name:");
    if (!name) return;

    const trimmed = name.trim();
    const first = trimmed[0];
    const isEmoji = /\p{Extended_Pictographic}/u.test(first);

    const folder: Folder = {
      id: `folder_${Date.now()}`,
      name: isEmoji ? trimmed.slice(1).trim() : trimmed,
      emoji: isEmoji ? first : "📁",
    };

    setFolders((prev) => [...prev, folder]);
    setActiveFolderId(folder.id);
  }

  /* ----------------------------- FILTER & SORT --------------------------- */

  const normalizedSearch = search.trim().toLowerCase();

  const visibleNotes = notes
    .filter((n) => {
      if (activeFolderId === "favorites" && !n.favorite) return false;
      if (activeFolderId === "pinned" && !n.pinned) return false;
      if (activeFolderId === "done" && !n.done) return false;

      if (
        activeFolderId !== "all" &&
        activeFolderId !== "favorites" &&
        activeFolderId !== "pinned" &&
        activeFolderId !== "done"
      ) {
        if ((n.folderId || "inbox") !== activeFolderId) return false;
      }

      if (!normalizedSearch) return true;
      return `${n.title} ${n.content}`
        .toLowerCase()
        .includes(normalizedSearch);
    })
    .sort((a, b) => {
      if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
      if (sort === "updated-desc") return b.updated - a.updated;
      if (sort === "updated-asc") return a.updated - b.updated;
      if (sort === "title") return a.title.localeCompare(b.title);
      return 0;
    });

  const active = notes.find((n) => n.id === activeNote) || null;

  /* ---------------------------- AI HELPERS ---------------------------- */

  function getModeLabel(mode: AiMode) {
    switch (mode) {
      case "free":
        return "Ask anything about this note or create content.";
      case "improve":
        return "Improve clarity and flow, keep your voice.";
      case "summarize":
        return "Summarize the note into clean bullets.";
      case "tasks":
        return "Extract action items with checkboxes.";
      case "rewrite":
        return "Rewrite more cleanly, preserving meaning.";
      default:
        return "";
    }
  }

  function getModeInstruction(mode: AiMode) {
    if (mode === "improve") return "Improve clarity and flow, keep the author's voice.";
    if (mode === "summarize") return "Summarize into short, clean bullet points.";
    if (mode === "tasks") return "Extract actionable tasks with checkboxes.";
    if (mode === "rewrite") return "Rewrite more clearly and concisely, preserving meaning.";
    return "Help in the most useful way for this note and request.";
  }

  function handleModeClick(mode: AiMode) {
    setAiMode(mode);
    // Just focus the input. No auto-filling, no weird text.
    setTimeout(() => aiInputRef.current?.focus(), 10);
  }

  async function handleAiSubmit(e: FormEvent) {
    e.preventDefault();
    if (aiLoading) return;

    const extra = aiInput.trim();
    const currentNote = active;

    if (!currentNote && !extra) return;

    setAiLoading(true);

    const noteContext = currentNote
      ? `Title:\n${currentNote.title}\n\nContent:\n${currentNote.content}`
      : "(no active note)";

    const modeInstruction = getModeInstruction(aiMode);

    const prompt = `
You are the Notepad AI inside VisuaRealm.

Mode: ${aiMode}
ModeInstruction: ${modeInstruction}

User extra request (if any):
${extra || "(none)"}

Current note context:
${noteContext}

Return ONLY the content that should be written into the note. No meta explanation, no preamble, no closing remarks.
    `.trim();

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: [{ role: "user", content: prompt }],
        }),
      });

      const data = await res.json();
      const reply: string = (data && data.reply) || "";

      if (!reply.trim()) return;

      if (currentNote) {
        if (aiMode === "summarize") {
          updateNote(currentNote.id, {
            content:
              currentNote.content +
              "\n\n---\nSummary:\n" +
              reply.trim(),
          });
        } else if (aiMode === "tasks") {
          updateNote(currentNote.id, {
            content:
              currentNote.content +
              "\n\n---\nTasks:\n" +
              reply.trim(),
          });
        } else if (aiMode === "free") {
          updateNote(currentNote.id, {
            content:
              currentNote.content +
              "\n\n---\nAI Output:\n" +
              reply.trim(),
          });
        } else {
          // improve / rewrite → replace content cleanly
          updateNote(currentNote.id, {
            content: reply.trim(),
          });
        }
      } else {
        const id = Date.now();
        const newNote: Note = {
          id,
          title: "AI Note",
          content: reply.trim(),
          pinned: false,
          favorite: false,
          done: false,
          updated: Date.now(),
          folderId: "inbox",
        };
        setNotes((prev) => [newNote, ...prev]);
        setActiveNote(id);
      }
    } finally {
      setAiLoading(false);
      // Clear the input so there is no weird leftover text.
      setAiInput("");
    }
  }

  /* --------------------------------- RENDER -------------------------------- */

  return (
    <main className="min-h-screen bg-gradient-to-b from-[#050510] via-[#050308] to-black px-4 py-4 pb-40 text-gray-100">
      {/* ------------------------- TOP NAV BUTTONS ------------------------- */}
      <div className="mx-auto mb-4 flex max-w-5xl justify-center gap-4">
        <TopNavButton href="/" label="Main Chat" emoji="💬" />
        <TopNavButton href="/chatlist" label="Chat List" emoji="📚" />
        <TopNavButton href="/whiteboard" label="Whiteboard" emoji="📝" />
        <TopNavButton href="/notepad" label="Notepad" emoji="📓" active />
        <TopNavButton href="/image" label="Image Gen" emoji="🎨" />
      </div>

      <div className="mx-auto flex max-w-5xl gap-4">
        {/* ----------------------------- SIDEBAR ----------------------------- */}
        <aside className="hidden w-60 shrink-0 flex-col rounded-2xl border border-neutral-800 bg-neutral-950/80 p-3 shadow-[0_0_30px_rgba(15,23,42,0.9)] md:flex">
          <header className="mb-2 flex items-center justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.2em] text-gray-500">
                VISUAREALM
              </p>
              <p className="text-sm font-semibold">Notepad</p>
            </div>
            <button
              onClick={addNote}
              className="rounded-full bg-blue-600 px-3 py-1 text-[11px] font-semibold text-white hover:bg-blue-500"
            >
              ✨ New
            </button>
          </header>

          <div className="mb-2 h-px w-full bg-gradient-to-r from-transparent via-neutral-700 to-transparent" />

          {/* Quick Folders */}
          <nav className="mb-3 space-y-1 text-sm">
            <SidebarItem
              label="All Notes"
              emoji="📓"
              active={activeFolderId === "all"}
              onClick={() => setActiveFolderId("all")}
            />
            <SidebarItem
              label="Favorites"
              emoji="⭐"
              active={activeFolderId === "favorites"}
              onClick={() => setActiveFolderId("favorites")}
            />
            <SidebarItem
              label="Pinned"
              emoji="📌"
              active={activeFolderId === "pinned"}
              onClick={() => setActiveFolderId("pinned")}
            />
            <SidebarItem
              label="Done"
              emoji="✅"
              active={activeFolderId === "done"}
              onClick={() => setActiveFolderId("done")}
            />
          </nav>

          <p className="mb-1 mt-1 text-[11px] uppercase tracking-[0.18em] text-gray-500">
            Folders
          </p>

          <div className="flex-1 space-y-1 overflow-y-auto pr-1 text-sm">
            {folders.map((folder) => (
              <SidebarItem
                key={folder.id}
                label={folder.name}
                emoji={folder.emoji}
                active={activeFolderId === folder.id}
                onClick={() => setActiveFolderId(folder.id)}
              />
            ))}
          </div>

          <button
            onClick={addFolder}
            className="mt-2 flex items-center justify-center gap-1 rounded-full border border-dashed border-neutral-700 bg-neutral-900/70 px-3 py-1 text-[11px] text-gray-300 hover:border-blue-500 hover:text-white"
          >
            <span>➕</span>
            <span>New Folder</span>
          </button>
        </aside>

        {/* ----------------------------- MAIN PANEL ----------------------------- */}
        <section className="flex-1 space-y-3">
          <div className="flex items-center justify-between gap-2">
            <div>
              <h1 className="text-lg font-semibold tracking-wide">
                {currentFolderLabel()}
              </h1>
              <p className="text-[11px] text-gray-400">
                Fast capture. Smart filters. Pinned notes always on top. AI
                upgrades built in.
              </p>
            </div>

            <div className="flex items-center gap-2 md:hidden">
              <button
                onClick={addNote}
                className="rounded-full bg-blue-600 px-3 py-1 text-[11px] font-semibold text-white hover:bg-blue-500"
              >
                + Note
              </button>
            </div>
          </div>

          {/* mobile folder chips */}
          <div className="flex gap-2 overflow-x-auto pb-1 text-[11px] md:hidden">
            <Chip
              label="All"
              emoji="📓"
              active={activeFolderId === "all"}
              onClick={() => setActiveFolderId("all")}
            />
            <Chip
              label="Fav"
              emoji="⭐"
              active={activeFolderId === "favorites"}
              onClick={() => setActiveFolderId("favorites")}
            />
            <Chip
              label="Pinned"
              emoji="📌"
              active={activeFolderId === "pinned"}
              onClick={() => setActiveFolderId("pinned")}
            />
            <Chip
              label="Done"
              emoji="✅"
              active={activeFolderId === "done"}
              onClick={() => setActiveFolderId("done")}
            />

            {folders.map((folder) => (
              <Chip
                key={folder.id}
                label={folder.name}
                emoji={folder.emoji}
                active={activeFolderId === folder.id}
                onClick={() => setActiveFolderId(folder.id)}
              />
            ))}
          </div>

          {/* search + sort */}
          <div className="flex flex-col gap-2 md:flex-row md:items-center">
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search notes..."
              className="w-full flex-1 rounded-full border border-neutral-700 bg-neutral-900 px-3 py-2 text-xs text-gray-100 outline-none placeholder:text-gray-500 focus:border-blue-500"
            />

            <select
              value={sort}
              onChange={(e) =>
                setSort(
                  e.target.value as "updated-desc" | "updated-asc" | "title"
                )
              }
              className="w-full rounded-full border border-neutral-700 bg-neutral-900 px-3 py-2 text-xs text-gray-100 outline-none focus:border-blue-500 md:w-44"
            >
              <option value="updated-desc">Recently Edited</option>
              <option value="updated-asc">Oldest Edited</option>
              <option value="title">Title (A→Z)</option>
            </select>
          </div>

          {/* notes list + editor */}
          <div className="flex flex-col gap-3 md:flex-row">
            {/* LIST */}
            <div className="space-y-2 md:w-[45%]">
              <button
                onClick={addNote}
                className="hidden w-full rounded-xl border border-dashed border-neutral-700 bg-neutral-900/70 px-3 py-2 text-xs font-semibold text-gray-200 hover:border-blue-500 hover:text-white md:block"
              >
                + Add Note
              </button>

              {visibleNotes.length === 0 && (
                <div className="mt-3 rounded-xl border border-neutral-800 bg-neutral-950/80 px-4 py-5 text-center text-xs text-gray-400">
                  No notes here yet.
                </div>
              )}

              <div className="space-y-2">
                {visibleNotes.map((note) => (
                  <motion.div
                    key={note.id}
                    onClick={() => setActiveNote(note.id)}
                    initial={{ opacity: 0, y: 4 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.15 }}
                    className={`cursor-pointer rounded-xl border px-3 py-2 text-xs transition ${
                      activeNote === note.id
                        ? "border-blue-500 bg-neutral-900/90 shadow-[0_0_18px_rgba(37,99,235,0.35)]"
                        : "border-neutral-800 bg-neutral-950/80 hover:border-neutral-600"
                    }`}
                  >
                    <div className="mb-1 flex items-center justify-between">
                      <h3 className="truncate text-[13px] font-semibold">
                        {note.title || "Untitled"}
                      </h3>

                      <div className="flex items-center gap-1 text-[13px]">
                        {note.pinned && <span>📌</span>}
                        {note.favorite && <span>⭐</span>}
                        {note.done && <span>✅</span>}
                      </div>
                    </div>

                    <p className="line-clamp-2 text-[11px] text-gray-400">
                      {note.content || "Empty note..."}
                    </p>

                    <div className="mt-1 flex items-center justify-between text-[10px] text-gray-500">
                      <span>
                        {new Date(note.updated).toLocaleTimeString([], {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </span>
                      <span>
                        {folders.find((f) => f.id === note.folderId)?.emoji ||
                          "📁"}
                      </span>
                    </div>
                  </motion.div>
                ))}
              </div>
            </div>

            {/* EDITOR */}
            <div className="md:w-[55%]">
              {!active ? (
                <div className="mt-3 flex h-full min-h-[220px] items-center justify-center rounded-2xl border border-dashed border-neutral-700 bg-neutral-950/70 px-4 py-6 text-center text-xs text-gray-400">
                  Select a note or create a new one.
                </div>
              ) : (
                <div className="space-y-3 rounded-2xl border border-neutral-800 bg-neutral-950/90 px-4 py-3 shadow-[0_0_25px_rgba(15,23,42,0.95)]">
                  <div className="flex items-center justify-between gap-2">
                    <input
                      value={active.title}
                      onChange={(e) =>
                        updateNote(active.id, { title: e.target.value })
                      }
                      className="w-full bg-transparent text-sm font-semibold outline-none placeholder:text-gray-500"
                      placeholder="Note title..."
                    />

                    <select
                      value={active.folderId || "inbox"}
                      onChange={(e) =>
                        updateNote(active.id, { folderId: e.target.value })
                      }
                      className="w-28 rounded-full border border-neutral-700 bg-neutral-900 px-2 py-1 text-[10px] text-gray-100 outline-none focus:border-blue-500"
                    >
                      {folders.map((f) => (
                        <option key={f.id} value={f.id}>
                          {f.emoji} {f.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <textarea
                    value={active.content}
                    onChange={(e) =>
                      updateNote(active.id, { content: e.target.value })
                    }
                    rows={10}
                    className="w-full resize-none bg-transparent text-xs leading-relaxed text-gray-100 outline-none placeholder:text-gray-500"
                    placeholder="Write freely..."
                  />

                  <div className="flex flex-wrap gap-2 pt-1 text-[11px]">
                    <ToggleButton
                      active={active.pinned}
                      onClick={() =>
                        updateNote(active.id, { pinned: !active.pinned })
                      }
                      label={active.pinned ? "Unpin" : "Pin"}
                      emoji="📌"
                    />
                    <ToggleButton
                      active={active.favorite}
                      onClick={() =>
                        updateNote(active.id, {
                          favorite: !active.favorite,
                        })
                      }
                      label={active.favorite ? "Unfavorite" : "Favorite"}
                      emoji="⭐"
                    />
                    <ToggleButton
                      active={active.done}
                      onClick={() =>
                        updateNote(active.id, { done: !active.done })
                      }
                      label={active.done ? "Not done" : "Done"}
                      emoji="✅"
                    />
                  </div>

                  <div className="mt-2 flex items-center justify-between">
                    <button
                      onClick={() => deleteNote(active.id)}
                      className="text-[11px] text-red-400 hover:text-red-300"
                    >
                      🗑️ Delete
                    </button>

                    <p className="text-[10px] text-gray-500">
                      Last edit{" "}
                      {new Date(active.updated).toLocaleString([], {
                        month: "short",
                        day: "2-digit",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </section>
      </div>

      {/* ---------------------------- AI DOCK ---------------------------- */}
      <div className="fixed bottom-0 left-0 right-0 z-40 border-t border-neutral-700 bg-[#0d0d16]/90 backdrop-blur-xl shadow-[0_-8px_30px_rgba(0,0,0,0.85)]">
        <div className="mx-auto flex w-full max-w-5xl flex-col gap-2 px-4 py-3">
          <div className="flex flex-wrap gap-2 text-[11px]">
            <DockButton
              active={aiMode === "free"}
              onClick={() => handleModeClick("free")}
              color="blue"
              emoji="🧠"
              label="Ask AI"
            />
            <DockButton
              active={aiMode === "improve"}
              onClick={() => handleModeClick("improve")}
              color="emerald"
              emoji="✨"
              label="Improve"
            />
            <DockButton
              active={aiMode === "summarize"}
              onClick={() => handleModeClick("summarize")}
              color="cyan"
              emoji="🧾"
              label="Summarize"
            />
            <DockButton
              active={aiMode === "tasks"}
              onClick={() => handleModeClick("tasks")}
              color="amber"
              emoji="✅"
              label="Tasks"
            />
            <DockButton
              active={aiMode === "rewrite"}
              onClick={() => handleModeClick("rewrite")}
              color="purple"
              emoji="🎨"
              label="Rewrite"
            />
          </div>

          <p className="text-[10px] text-gray-500">
            {getModeLabel(aiMode)}
          </p>

          <form
            onSubmit={handleAiSubmit}
            className="flex items-center gap-2 text-xs"
          >
            <input
              ref={aiInputRef}
              value={aiInput}
              onChange={(e) => setAiInput(e.target.value)}
              className="flex-1 rounded-full border border-neutral-700 bg-neutral-900 px-3 py-2 text-xs text-gray-100 outline-none placeholder:text-gray-500 focus:border-blue-500"
              placeholder={
                active
                  ? "Optional: add extra instructions for how AI should transform this note..."
                  : "No active note — describe what you want AI to create (e.g. outline, draft, list)..."
              }
            />
            <button
              disabled={aiLoading}
              className="rounded-full bg-blue-600 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-500 disabled:opacity-60"
            >
              {aiLoading ? "Thinking..." : "Run AI"}
            </button>
          </form>
        </div>
      </div>
    </main>
  );
}

/* ------------------------------ COMPONENTS ------------------------------ */

function TopNavButton({
  href,
  label,
  emoji,
  active,
}: {
  href: string;
  label: string;
  emoji: string;
  active?: boolean;
}) {
  return (
    <a
      href={href}
      className={`rounded-xl px-4 py-2 text-sm flex items-center gap-2 transition ${
        active
          ? "border border-blue-500/70 bg-blue-600/20 text-blue-200 shadow-[0_0_14px_rgba(37,99,235,0.4)]"
          : "border border-neutral-700 bg-neutral-900/80 text-gray-300 hover:border-blue-500 hover:text-blue-200"
      }`}
    >
      <span>{emoji}</span>
      <span>{label}</span>
    </a>
  );
}

function SidebarItem({
  label,
  emoji,
  active,
  onClick,
}: {
  label: string;
  emoji: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex w-full items-center gap-2 rounded-xl px-2 py-1.5 text-left text-[13px] transition ${
        active
          ? "border border-blue-500/70 bg-blue-600/20 text-blue-100 shadow-[0_0_14px_rgba(37,99,235,0.4)]"
          : "border border-transparent text-gray-300 hover:bg-neutral-900/90 hover:text-white"
      }`}
    >
      <span className="text-base">{emoji}</span>
      <span className="truncate">{label}</span>
    </button>
  );
}

function Chip({
  label,
  emoji,
  active,
  onClick,
}: {
  label: string;
  emoji: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-1 rounded-full border px-3 py-1 ${
        active
          ? "border-blue-500 bg-blue-600/20 text-blue-100"
          : "border-neutral-700 bg-neutral-900/70 text-gray-300"
      }`}
    >
      <span className="text-sm">{emoji}</span>
      <span>{label}</span>
    </button>
  );
}

function ToggleButton({
  active,
  onClick,
  label,
  emoji,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  emoji: string;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-1 rounded-full border px-3 py-1 text-[11px] ${
        active
          ? "border-emerald-500 bg-emerald-600/20 text-emerald-100"
          : "border-neutral-700 bg-neutral-900/90 text-gray-300"
      }`}
    >
      <span>{emoji}</span>
      <span>{label}</span>
    </button>
  );
}

function DockButton({
  active,
  onClick,
  color,
  emoji,
  label,
}: {
  active: boolean;
  onClick: () => void;
  color: "blue" | "emerald" | "cyan" | "amber" | "purple";
  emoji: string;
  label: string;
}) {
  const activeStyles =
    color === "blue"
      ? "border-blue-500 bg-blue-600/20 text-blue-100"
      : color === "emerald"
      ? "border-emerald-500 bg-emerald-600/20 text-emerald-100"
      : color === "cyan"
      ? "border-cyan-500 bg-cyan-600/20 text-cyan-100"
      : color === "amber"
      ? "border-amber-500 bg-amber-500/20 text-amber-100"
      : "border-purple-500 bg-purple-600/20 text-purple-100";

  return (
    <button
      onClick={onClick}
      type="button"
      className={`rounded-full border px-3 py-1 ${
        active
          ? activeStyles
          : "border-neutral-700 bg-neutral-900/80 text-gray-300"
      }`}
    >
      {emoji} {label}
    </button>
  );
}

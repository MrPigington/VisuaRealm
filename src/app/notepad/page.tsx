"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";

interface Note {
  id: number;
  title: string;
  content: string;
  pinned: boolean;
  favorite: boolean;
  done: boolean;
  updated: number;
  folderId?: string; // new: basic folder support
}

interface Folder {
  id: string;
  name: string;
  emoji: string;
  builtIn?: boolean;
}

const STORAGE_KEY_V2 = "vr_notepad_v2";
const LEGACY_STORAGE_KEY = "vr_notepad";

// system / virtual folders (not stored in folders[])
type SystemFolderId = "all" | "favorites" | "pinned" | "done" | "inbox";

export default function NotepadPage() {
  const [notes, setNotes] = useState<Note[]>([]);
  const [folders, setFolders] = useState<Folder[]>([]);
  const [activeFolderId, setActiveFolderId] = useState<SystemFolderId | string>("all");

  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<"updated-desc" | "updated-asc" | "title">(
    "updated-desc"
  );
  const [activeNote, setActiveNote] = useState<number | null>(null);

  // ---- LOAD FROM LOCALSTORAGE (v2 + legacy) ----
  useEffect(() => {
    try {
      const storedV2 = localStorage.getItem(STORAGE_KEY_V2);

      if (storedV2) {
        const parsed = JSON.parse(storedV2) as {
          notes: Note[];
          folders: Folder[];
        };

        setNotes(parsed.notes || []);
        setFolders(
          parsed.folders && parsed.folders.length > 0
            ? parsed.folders
            : getDefaultFolders()
        );
        return;
      }

      // legacy support: plain notes array
      const legacy = localStorage.getItem(LEGACY_STORAGE_KEY);
      if (legacy) {
        const parsedLegacy = JSON.parse(legacy) as Note[];
        // assign all legacy notes to inbox
        const migrated = parsedLegacy.map((n) => ({
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

  // ---- SAVE TO LOCALSTORAGE (v2) ----
  useEffect(() => {
    const payload = JSON.stringify({ notes, folders });
    localStorage.setItem(STORAGE_KEY_V2, payload);
  }, [notes, folders]);

  function getDefaultFolders(): Folder[] {
    return [
      {
        id: "inbox",
        name: "Inbox",
        emoji: "📥",
        builtIn: true,
      },
      {
        id: "work",
        name: "Work",
        emoji: "💼",
        builtIn: true,
      },
      {
        id: "ideas",
        name: "Ideas",
        emoji: "🧠",
        builtIn: true,
      },
      {
        id: "personal",
        name: "Personal",
        emoji: "🌙",
        builtIn: true,
      },
      {
        id: "archive",
        name: "Archive",
        emoji: "🗂️",
        builtIn: true,
      },
    ];
  }

  function currentFolderLabel() {
    if (activeFolderId === "all") return "All Notes";
    if (activeFolderId === "favorites") return "Favorites";
    if (activeFolderId === "pinned") return "Pinned";
    if (activeFolderId === "done") return "Done";
    const folder = folders.find((f) => f.id === activeFolderId);
    return folder ? folder.name : "Notes";
  }

  // ---- CRUD ----
  function addNote() {
    const id = Date.now();

    // choose folder for new note
    const baseFolderId: string =
      activeFolderId === "all" ||
      activeFolderId === "favorites" ||
      activeFolderId === "pinned" ||
      activeFolderId === "done"
        ? "inbox"
        : (activeFolderId as string);

    const newNote: Note = {
      id,
      title: "Untitled Note",
      content: "",
      pinned: false,
      favorite: false,
      done: false,
      updated: Date.now(),
      folderId: baseFolderId,
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
    const name = window.prompt("Folder name (you can start with an emoji, e.g. 🔬 Lab)");
    if (!name) return;

    // very simple emoji guess (first char)
    const trimmed = name.trim();
    const firstChar = trimmed[0];
    const hasEmojiPrefix = /\p{Extended_Pictographic}/u.test(firstChar);

    const folder: Folder = {
      id: `folder_${Date.now()}`,
      name: hasEmojiPrefix ? trimmed.slice(1).trim() || "Folder" : trimmed,
      emoji: hasEmojiPrefix ? firstChar : "📁",
    };

    setFolders((prev) => [...prev, folder]);
    setActiveFolderId(folder.id);
  }

  function moveNoteToFolder(noteId: number, folderId: string) {
    updateNote(noteId, { folderId });
  }

  // ---- FILTER + SORT ----
  const normalizedSearch = search.trim().toLowerCase();

  const visibleNotes = notes
    .filter((n) => {
      // folder filter
      if (activeFolderId === "favorites" && !n.favorite) return false;
      if (activeFolderId === "pinned" && !n.pinned) return false;
      if (activeFolderId === "done" && !n.done) return false;

      if (
        activeFolderId !== "all" &&
        activeFolderId !== "favorites" &&
        activeFolderId !== "pinned" &&
        activeFolderId !== "done"
      ) {
        const folderId = n.folderId || "inbox";
        if (folderId !== activeFolderId) return false;
      }

      if (!normalizedSearch) return true;
      return `${n.title} ${n.content}`.toLowerCase().includes(normalizedSearch);
    })
    .sort((a, b) => {
      // pinned always on top
      if (a.pinned !== b.pinned) {
        return a.pinned ? -1 : 1;
      }

      if (sort === "updated-desc") return b.updated - a.updated;
      if (sort === "updated-asc") return a.updated - b.updated;
      if (sort === "title") return a.title.localeCompare(b.title);
      return 0;
    });

  const active = notes.find((n) => n.id === activeNote) || null;

  return (
    <main className="min-h-screen bg-gradient-to-b from-[#050510] via-[#050308] to-black text-gray-100 px-4 py-4 pb-24">
      <div className="mx-auto flex max-w-5xl gap-4">

        {/* SIDEBAR — FOLDER TREE */}
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

          <div className="h-px w-full bg-gradient-to-r from-transparent via-neutral-700 to-transparent mb-2" />

          {/* Quick Views */}
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

          <p className="mt-1 mb-1 text-[11px] uppercase tracking-[0.18em] text-gray-500">
            Folders
          </p>

          <div className="flex-1 space-y-1 overflow-y-auto pr-1 text-sm">
            {folders.map((folder) => (
              <SidebarItem
                key={folder.id}
                label={folder.name}
                emoji={folder.emoji}
                active={activeFolderId === folder.id}
                onClick={() => setActiveFolderId(folder.id as string)}
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

        {/* MAIN COLUMN */}
        <section className="flex-1 space-y-3">
          {/* TOP BAR (Mobile + Title) */}
          <div className="flex items-center justify-between gap-2 md:justify-between">
            <div>
              <h1 className="text-lg font-semibold tracking-wide">
                {currentFolderLabel()}
              </h1>
              <p className="text-[11px] text-gray-400">
                Fast capture. Smart filters. Pinned notes always on top.
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

          {/* Mobile folder strip */}
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

          {/* Search + Sort */}
          <div className="flex flex-col gap-2 md:flex-row md:items-center">
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search notes by title or content..."
              className="w-full flex-1 rounded-full border border-neutral-700 bg-neutral-900 px-3 py-2 text-xs text-gray-100 outline-none placeholder:text-gray-500 focus:border-blue-500"
            />
            <select
              value={sort}
              onChange={(e) =>
                setSort(e.target.value as "updated-desc" | "updated-asc" | "title")
              }
              className="w-full rounded-full border border-neutral-700 bg-neutral-900 px-3 py-2 text-xs text-gray-100 outline-none focus:border-blue-500 md:w-44"
            >
              <option value="updated-desc">Recently Edited</option>
              <option value="updated-asc">Oldest Edited</option>
              <option value="title">Title (A → Z)</option>
            </select>
          </div>

          {/* LAYOUT: LIST + EDITOR */}
          <div className="flex flex-col gap-3 md:flex-row">
            {/* Notes List */}
            <div className="md:w-[45%] space-y-2">
              <button
                onClick={addNote}
                className="hidden w-full rounded-xl border border-dashed border-neutral-700 bg-neutral-900/70 px-3 py-2 text-xs font-semibold text-gray-200 hover:border-blue-500 hover:text-white md:block"
              >
                + Add Note
              </button>

              {visibleNotes.length === 0 && (
                <div className="mt-3 rounded-xl border border-neutral-800 bg-neutral-950/80 px-4 py-5 text-center text-xs text-gray-400">
                  No notes here yet.
                  <br />
                  Start with a quick idea, task list, or brain dump.
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
                    <div className="mb-1 flex items-center justify-between gap-2">
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
                      <span className="opacity-70">
                        {folders.find((f) => f.id === (note.folderId || "inbox"))
                          ?.emoji || "📁"}
                      </span>
                    </div>
                  </motion.div>
                ))}
              </div>
            </div>

            {/* Editor */}
            <div className="md:w-[55%]">
              {!active && (
                <div className="mt-3 flex h-full min-h-[220px] items-center justify-center rounded-2xl border border-dashed border-neutral-700 bg-neutral-950/70 px-4 py-6 text-center text-xs text-gray-400">
                  Select a note on the left, or create a new one to start writing.
                </div>
              )}

              {active && (
                <div className="rounded-2xl border border-neutral-800 bg-neutral-950/90 px-4 py-3 shadow-[0_0_25px_rgba(15,23,42,0.95)] space-y-3">
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
                        moveNoteToFolder(active.id, e.target.value)
                      }
                      className="w-28 rounded-full border border-neutral-700 bg-neutral-900 px-2 py-1 text-[10px] text-gray-100 outline-none focus:border-blue-500"
                    >
                      {folders.map((folder) => (
                        <option key={folder.id} value={folder.id}>
                          {folder.emoji} {folder.name}
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
                    placeholder="Write freely. Ideas, tasks, drafts, lyrics, plans..."
                  />

                  {/* Toggles */}
                  <div className="flex flex-wrap gap-2 text-[11px] pt-1">
                    <ToggleButton
                      active={active.pinned}
                      onClick={() =>
                        updateNote(active.id, { pinned: !active.pinned })
                      }
                      label={active.pinned ? "Unpin" : "Pin to top"}
                      emoji="📌"
                    />
                    <ToggleButton
                      active={active.favorite}
                      onClick={() =>
                        updateNote(active.id, { favorite: !active.favorite })
                      }
                      label={active.favorite ? "Unfavorite" : "Mark favorite"}
                      emoji="⭐"
                    />
                    <ToggleButton
                      active={active.done}
                      onClick={() =>
                        updateNote(active.id, { done: !active.done })
                      }
                      label={active.done ? "Mark not done" : "Mark done"}
                      emoji="✅"
                    />
                  </div>

                  <div className="mt-2 flex items-center justify-between">
                    <button
                      onClick={() => deleteNote(active.id)}
                      className="text-[11px] text-red-400 hover:text-red-300"
                    >
                      🗑️ Delete note
                    </button>
                    <p className="text-[10px] text-gray-500">
                      Last edited{" "}
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
    </main>
  );
}

/* -------- Small UI Pieces -------- */

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
          ? "bg-blue-600/20 text-blue-100 border border-blue-500/70 shadow-[0_0_14px_rgba(37,99,235,0.4)]"
          : "text-gray-300 hover:bg-neutral-900/90 hover:text-white border border-transparent"
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
      className={`flex items-center gap-1 rounded-full border px-3 py-1 ${
        active
          ? "border-emerald-500 bg-emerald-600/20 text-emerald-100"
          : "border-neutral-700 bg-neutral-900/90 text-gray-300"
      } text-[11px]`}
    >
      <span>{emoji}</span>
      <span>{label}</span>
    </button>
  );
}

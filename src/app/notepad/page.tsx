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
}

export default function NotepadPage() {
  const [notes, setNotes] = useState<Note[]>([]);
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState("updated-desc"); // latest edited first
  const [activeNote, setActiveNote] = useState<number | null>(null);

  // Load from localStorage
  useEffect(() => {
    const stored = localStorage.getItem("vr_notepad");
    if (stored) setNotes(JSON.parse(stored));
  }, []);

  // Save to localStorage
  useEffect(() => {
    localStorage.setItem("vr_notepad", JSON.stringify(notes));
  }, [notes]);

  function addNote() {
    const id = Date.now();
    const newNote: Note = {
      id,
      title: "Untitled Note",
      content: "",
      pinned: false,
      favorite: false,
      done: false,
      updated: Date.now(),
    };
    setNotes([newNote, ...notes]);
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

  // Search + Sort
  const filtered = notes
    .filter((n) =>
      `${n.title} ${n.content}`.toLowerCase().includes(search.toLowerCase())
    )
    .sort((a, b) => {
      if (sort === "updated-desc") return b.updated - a.updated;
      if (sort === "updated-asc") return a.updated - b.updated;
      if (sort === "title") return a.title.localeCompare(b.title);
      return 0;
    });

  const active = notes.find((n) => n.id === activeNote);

  return (
    <main className="min-h-screen bg-[#0d0d0d] text-gray-100 p-4 pb-20">
      <h1 className="text-xl font-bold mb-4">Notepad</h1>

      {/* Search + Sort */}
      <div className="flex gap-2 mb-4">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search notes..."
          className="flex-1 p-2 rounded bg-neutral-900 border border-neutral-700"
        />
        <select
          value={sort}
          onChange={(e) => setSort(e.target.value)}
          className="p-2 rounded bg-neutral-900 border border-neutral-700"
        >
          <option value="updated-desc">Recently Edited</option>
          <option value="updated-asc">Oldest Edited</option>
          <option value="title">Title</option>
        </select>
      </div>

      {/* Notes List */}
      {!activeNote && (
        <div className="space-y-3">
          <button
            onClick={addNote}
            className="bg-blue-600 w-full py-2 rounded text-white font-semibold"
          >
            + Add Note
          </button>

          {filtered.length === 0 && (
            <p className="text-sm text-gray-400 text-center mt-6">
              No notes yet. Create one!
            </p>
          )}

          {filtered.map((note) => (
            <motion.div
              key={note.id}
              onClick={() => setActiveNote(note.id)}
              className="p-4 rounded bg-neutral-900 border border-neutral-800 hover:border-blue-500 transition cursor-pointer"
            >
              <div className="flex justify-between items-center mb-1">
                <h3 className="font-semibold text-sm">{note.title}</h3>

                <div className="flex gap-2 text-xs">
                  {note.pinned && <span>📌</span>}
                  {note.favorite && <span>❤️</span>}
                  {note.done && <span>✓</span>}
                </div>
              </div>

              <p className="text-xs text-gray-400 line-clamp-2">
                {note.content || "Empty note..."}
              </p>
            </motion.div>
          ))}
        </div>
      )}

      {/* Editor View */}
      {active && (
        <div className="space-y-4">
          <button
            onClick={() => setActiveNote(null)}
            className="text-blue-400 text-sm"
          >
            ← Back to Notes
          </button>

          <div className="p-4 rounded bg-neutral-900 border border-neutral-800 space-y-3">
            <input
              value={active.title}
              onChange={(e) =>
                updateNote(active.id, { title: e.target.value })
              }
              className="w-full bg-transparent text-lg font-semibold outline-none"
            />

            <textarea
              value={active.content}
              onChange={(e) =>
                updateNote(active.id, { content: e.target.value })
              }
              rows={12}
              className="w-full bg-transparent outline-none text-sm"
            />

            {/* Toggles */}
            <div className="flex gap-3 text-sm pt-2">
              <button
                onClick={() => updateNote(active.id, { pinned: !active.pinned })}
                className="px-3 py-1 rounded bg-neutral-800 border border-neutral-700"
              >
                {active.pinned ? "📌 Unpin" : "📌 Pin"}
              </button>

              <button
                onClick={() =>
                  updateNote(active.id, { favorite: !active.favorite })
                }
                className="px-3 py-1 rounded bg-neutral-800 border border-neutral-700"
              >
                {active.favorite ? "❤️ Unfavorite" : "❤️ Favorite"}
              </button>

              <button
                onClick={() => updateNote(active.id, { done: !active.done })}
                className="px-3 py-1 rounded bg-neutral-800 border border-neutral-700"
              >
                {active.done ? "✓ Undone" : "✓ Mark Done"}
              </button>
            </div>

            <button
              onClick={() => deleteNote(active.id)}
              className="text-red-400 text-sm mt-2"
            >
              Delete Note
            </button>
          </div>
        </div>
      )}
    </main>
  );
}

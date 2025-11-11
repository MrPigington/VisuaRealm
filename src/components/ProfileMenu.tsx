"use client";
import { useState } from "react";

export default function ProfileMenu() {
  const [open, setOpen] = useState(false);

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="w-10 h-10 rounded-full bg-gradient-to-r from-purple-600 to-blue-600 flex items-center justify-center text-white hover:opacity-90 transition"
      >
        👤
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-48 bg-neutral-900 border border-neutral-800 rounded-xl shadow-xl p-3 space-y-2 text-sm">
          <button className="w-full bg-gradient-to-r from-blue-600 to-purple-600 rounded-md py-1.5 hover:opacity-90 transition">
            Sign in
          </button>
          <button className="w-full bg-neutral-800 rounded-md py-1.5 hover:bg-neutral-700 transition">
            Log out
          </button>
        </div>
      )}
    </div>
  );
}

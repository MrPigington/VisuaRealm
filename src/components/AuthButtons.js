"use client";

import { supabase } from "@/lib/supabaseClient"; // ✅ absolute import (uses tsconfig paths)
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

export default function AuthButtons() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);

  useEffect(() => {
    const getUser = async () => {
      const { data } = await supabase.auth.getUser();
      setUser(data?.user || null);
    };
    getUser();
  }, []);

  async function handleLogout() {
    await supabase.auth.signOut();
    router.push("/login");
  }

  if (user) {
    return (
      <button
        onClick={handleLogout}
        className="bg-red-500 hover:bg-red-600 text-white px-4 py-2 rounded-md transition"
      >
        Log Out
      </button>
    );
  }

  return (
    <button
      onClick={() => router.push("/login")}
      className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded-md transition"
    >
      Log In
    </button>
  );
}

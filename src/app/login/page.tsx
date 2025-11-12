"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

// ✅ Prevents Vercel from prerendering or caching
export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [mode, setMode] = useState<"signin" | "signup">("signin");

  // 🔁 Auto-redirect if already logged in
  useEffect(() => {
    const checkUser = async () => {
      const { data } = await supabase.auth.getUser();
      if (data?.user) router.push("/chat");
    };
    checkUser();
  }, [router]);

  // 🔐 Handle Sign In
  async function handleSignIn() {
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    setLoading(false);
    if (error) alert(error.message);
    else router.push("/chat");
  }

  // 🪪 Handle Sign Up
  async function handleSignUp() {
    setLoading(true);
    const { error } = await supabase.auth.signUp({
      email,
      password,
    });
    setLoading(false);
    if (error) alert(error.message);
    else alert("✅ Account created! Check your email for verification.");
  }

  // 💻 UI
  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gray-50">
      <div className="w-full max-w-sm bg-white shadow-lg rounded-xl p-8">
        <h1 className="text-2xl font-bold mb-4 text-center text-gray-800">
          {mode === "signin" ? "Sign In" : "Create Account"}
        </h1>

        <input
          type="email"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="w-full border border-gray-300 p-2 rounded mb-3 focus:outline-none focus:ring focus:ring-blue-200"
        />
        <input
          type="password"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="w-full border border-gray-300 p-2 rounded mb-4 focus:outline-none focus:ring focus:ring-blue-200"
        />

        <button
          onClick={mode === "signin" ? handleSignIn : handleSignUp}
          disabled={loading}
          className="w-full bg-blue-500 hover:bg-blue-600 text-white py-2 rounded font-semibold transition disabled:opacity-60"
        >
          {loading
            ? "Processing..."
            : mode === "signin"
            ? "Sign In"
            : "Sign Up"}
        </button>

        <p className="mt-4 text-center text-sm text-gray-600">
          {mode === "signin" ? (
            <>
              Don’t have an account?{" "}
              <button
                className="text-blue-600 underline"
                onClick={() => setMode("signup")}
              >
                Sign Up
              </button>
            </>
          ) : (
            <>
              Already have an account?{" "}
              <button
                className="text-blue-600 underline"
                onClick={() => setMode("signin")}
              >
                Sign In
              </button>
            </>
          )}
        </p>
      </div>
    </div>
  );
}

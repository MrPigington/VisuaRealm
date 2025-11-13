"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [mode, setMode] = useState<"signin" | "signup">("signin");

  async function handleSignIn() {
    try {
      setLoading(true);
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      setLoading(false);
      if (error) return alert(error.message);
      router.push("/chat");
    } catch (err) {
      console.error(err);
      alert("Unexpected error signing in.");
    }
  }

  async function handleSignUp() {
    try {
      setLoading(true);
      const { error } = await supabase.auth.signUp({
        email,
        password,
      });
      setLoading(false);
      if (error) return alert(error.message);

      alert("✅ Account created! Check your email if verification is required.");
    } catch (err) {
      console.error(err);
      alert("Unexpected error creating account.");
    }
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-neutral-900 text-gray-100">
      <div className="w-full max-w-sm bg-neutral-800 shadow-lg rounded-xl p-8 border border-neutral-700">
        <h1 className="text-2xl font-bold mb-4 text-center">
          {mode === "signin" ? "Sign In" : "Create Account"}
        </h1>

        <input
          type="email"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="w-full bg-neutral-700 text-gray-100 border border-neutral-600 p-2 rounded mb-3 focus:outline-none focus:ring focus:ring-blue-400"
        />

        <input
          type="password"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="w-full bg-neutral-700 text-gray-100 border border-neutral-600 p-2 rounded mb-4 focus:outline-none focus:ring focus:ring-blue-400"
        />

        <button
          onClick={mode === "signin" ? handleSignIn : handleSignUp}
          disabled={loading}
          className="w-full bg-blue-600 hover:bg-blue-700 text-white py-2 rounded font-semibold transition disabled:opacity-60"
        >
          {loading
            ? "Processing..."
            : mode === "signin"
            ? "Sign In"
            : "Sign Up"}
        </button>

        <p className="mt-4 text-center text-sm text-gray-400">
          {mode === "signin" ? (
            <>
              Don’t have an account?{" "}
              <button
                className="text-blue-400 underline"
                onClick={() => setMode("signup")}
              >
                Sign Up
              </button>
            </>
          ) : (
            <>
              Already have an account?{" "}
              <button
                className="text-blue-400 underline"
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

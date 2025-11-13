"use client";

import React, { useState } from "react";

export default function ImagePage() {
  const [prompt, setPrompt] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [resultImage, setResultImage] = useState<string | null>(null);
  const [resultText, setResultText] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  /* --------------------------------------------------
        🔥 Generate AI Image (uses /api/image)
  ---------------------------------------------------*/
  async function generateImage() {
    if (!prompt.trim()) return;

    setLoading(true);
    setResultImage(null);
    setResultText(null);

    try {
      const res = await fetch("/api/image", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt }),
      });

      const data = await res.json();

      if (data.image) {
        setResultImage(data.image);
      } else {
        setResultText(data.error || "⚠️ No image returned.");
      }
    } catch (err) {
      console.error("❌ generateImage error:", err);
      setResultText("⚠️ Error generating image.");
    }

    setLoading(false);
  }

  /* --------------------------------------------------
        🔍 Analyze Uploaded Image → Text
        (uses existing /api/chat vision logic)
  ---------------------------------------------------*/
  async function analyzeImage() {
    if (!file) return;

    setLoading(true);
    setResultImage(null);
    setResultText(null);

    try {
      const formData = new FormData();
      formData.append(
        "messages",
        JSON.stringify([
          {
            role: "user",
            content: "Describe this image in full detail. Focus on objects, colors, style, scene."
          }
        ])
      );
      formData.append("file", file);

      const res = await fetch("/api/chat", {
        method: "POST",
        body: formData,
      });

      const data = await res.json();
      setResultText(data.reply || "No response.");
    } catch (err) {
      console.error("❌ analyzeImage error:", err);
      setResultText("⚠️ Error analyzing image.");
    }

    setLoading(false);
  }

  return (
    <main className="min-h-screen bg-black text-white p-6 pb-32">
      <h1 className="text-2xl font-bold mb-6">🎨 AI Image Studio</h1>

      {/* --------------------------------------------------
            IMAGE GENERATION
      --------------------------------------------------- */}
      <div className="mb-10 p-4 bg-neutral-900 rounded-lg border border-neutral-700">
        <h2 className="text-lg font-semibold mb-2">Generate Image</h2>

        <textarea
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder="Describe what you want generated..."
          className="w-full bg-neutral-800 p-3 rounded outline-none mb-3"
          rows={4}
        />

        <button
          onClick={generateImage}
          disabled={loading}
          className="bg-blue-600 hover:bg-blue-700 px-4 py-2 rounded disabled:opacity-60 w-full"
        >
          Generate Image
        </button>
      </div>

      {/* --------------------------------------------------
            IMAGE → TEXT ANALYSIS
      --------------------------------------------------- */}
      <div className="mb-10 p-4 bg-neutral-900 rounded-lg border border-neutral-700">
        <h2 className="text-lg font-semibold mb-2">Analyze Image</h2>

        <input
          type="file"
          onChange={(e) => setFile(e.target.files?.[0] || null)}
          className="mb-3 text-gray-300"
        />

        <button
          onClick={analyzeImage}
          disabled={loading}
          className="bg-green-600 hover:bg-green-700 px-4 py-2 rounded disabled:opacity-60 w-full"
        >
          Analyze / Describe
        </button>
      </div>

      {/* --------------------------------------------------
            OUTPUT
      --------------------------------------------------- */}
      <div className="p-4 bg-neutral-900 rounded-lg border border-neutral-700 mb-20">
        <h2 className="text-lg font-semibold mb-3">Result</h2>

        {loading && <p className="italic text-gray-400">Processing...</p>}

        {resultImage && (
          <img
            src={resultImage}
            className="w-full rounded border border-neutral-700 mb-4"
            alt="Generated result"
          />
        )}

        {resultText && (
          <p className="text-gray-300 whitespace-pre-wrap">{resultText}</p>
        )}
      </div>
    </main>
  );
}

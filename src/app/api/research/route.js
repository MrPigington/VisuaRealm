import OpenAI from "openai";
import { promises as fs } from "fs";

export const runtime = "nodejs"; // ✅ Use Node instead of Edge

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function POST(req) {
  try {
    const contentType = req.headers.get("content-type") || "";

    // 🟣 Handle image upload (multipart)
    if (contentType.includes("multipart/form-data")) {
      const formData = await req.formData();
      const messages = JSON.parse(formData.get("messages") || "[]");
      const file = formData.get("file");

      if (!file) {
        return new Response(JSON.stringify({ reply: "⚠️ No file uploaded." }), {
          status: 400,
          headers: { "Content-Type": "application/json" },
        });
      }

      // ✅ Read the file into base64
      const arrayBuffer = await file.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);
      const base64 = buffer.toString("base64");
      const mimeType = file.type || "image/png";
      const imageData = `data:${mimeType};base64,${base64}`;

      // 🔍 Ask GPT to analyze the image
      const completion = await client.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content:
              "You are VisuaRealm — an AI assistant that can analyze and describe uploaded images. Be concise and respond in Markdown.",
          },
          ...messages,
          {
            role: "user",
            content: [
              { type: "text", text: "Please analyze this image and describe what you see." },
              { type: "image_url", image_url: imageData },
            ],
          },
        ],
      });

      const reply =
        completion.choices?.[0]?.message?.content?.trim() ||
        "⚠️ Could not analyze image.";

      return new Response(JSON.stringify({ reply }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }

    // 🟢 Handle text-only messages
    if (contentType.includes("application/json")) {
      const { messages } = await req.json();

      const completion = await client.chat.completions.create({
        model: "gpt-4o-mini",
        temperature: 0.7,
        messages: [
          {
            role: "system",
            content:
              "You are VisuaRealm — an intelligent, expressive assistant. Always respond in Markdown and structured paragraphs.",
          },
          ...messages,
        ],
      });

      const reply =
        completion.choices?.[0]?.message?.content?.trim() || "⚠️ No response generated.";
      return new Response(JSON.stringify({ reply }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ reply: "⚠️ Unsupported request type." }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("❌ Chat route error:", err);
    return new Response(
      JSON.stringify({
        reply: "⚠️ Server error — AI couldn’t process the image. Try again.",
      }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}

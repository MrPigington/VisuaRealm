export const runtime = "nodejs"; // must be FIRST

import OpenAI from "openai";
const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export async function POST(req) {
  try {
    const type = req.headers.get("content-type") || "";

    // 🟢 plain JSON (text only)
    if (type.includes("application/json")) {
      const { messages } = await req.json();
      return await handleText(messages);
    }

    // 🟣 multipart form (text ± image)
    if (type.includes("multipart/form-data")) {
      const form = await req.formData();
      const messages = JSON.parse(form.get("messages") || "[]");
      const file = form.get("file");
      const userMsg = messages.at(-1)?.content || "";

      // no file → text fallback
      if (!(file instanceof File) || file.size === 0) {
        console.log("🟢 No file uploaded — text-only path");
        return await handleText(messages);
      }

      // convert stream → buffer (works on all Vercel runtimes)
      const buf = await streamToBuffer(file.stream());
      const base64 = Buffer.from(buf).toString("base64");
      const mime = file.type || "image/png";
      const dataUrl = `data:${mime};base64,${base64}`;

      // 🧠 GPT-4o Vision call
      const completion = await client.chat.completions.create({
        model: "gpt-4o-mini",
        temperature: 0.7,
        messages: [
          {
            role: "system",
            content: `
You are VisuaRealm — an AI that analyzes uploaded images and formats replies beautifully in Markdown.
Always include:
• A short visual description first
• Then clear bullet points or structured insights
• Use bold text and headings when helpful
            `,
          },
          ...messages,
          {
            role: "user",
            content: [
              { type: "text", text: `Analyze this image and help with: ${userMsg}` },
              // ✅ correct schema — image_url is now an object
              { type: "image_url", image_url: { url: dataUrl } },
            ],
          },
        ],
      });

      const reply =
        completion.choices?.[0]?.message?.content?.trim() ||
        "⚠️ No analysis produced.";
      return json(reply);
    }

    // 🚫 anything else
    return json("⚠️ Unsupported request type.", 400);
  } catch (err) {
    console.error("❌ Chat route error:", err);
    return json(
      `⚠️ ${err.message || "Server error. Please try again later."}`,
      500
    );
  }
}

// ─── helpers ─────────────────────────────────────────────────────────────

async function handleText(messages = []) {
  const completion = await client.chat.completions.create({
    model: "gpt-4o-mini",
    temperature: 0.7,
    messages: [
      {
        role: "system",
        content: `
You are VisuaRealm — an intelligent Markdown-formatted assistant.
Always:
• Structure replies with headings, bullet points, and code fences
• Keep responses clear and visually organized
        `,
      },
      ...messages,
    ],
  });

  const reply =
    completion.choices?.[0]?.message?.content?.trim() || "⚠️ No response generated.";
  return json(reply);
}

function json(reply, status = 200) {
  return new Response(JSON.stringify({ reply }), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

async function streamToBuffer(readable) {
  const chunks = [];
  for await (const chunk of readable) chunks.push(chunk);
  return Buffer.concat(chunks);
}

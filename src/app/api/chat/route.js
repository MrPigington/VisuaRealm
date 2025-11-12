export const runtime = "nodejs"; // must be FIRST

import OpenAI from "openai";

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function POST(req) {
  try {
    const type = req.headers.get("content-type") || "";

    // 🟢 Handle plain JSON text
    if (type.includes("application/json")) {
      const { messages } = await req.json();
      return await handleText(messages);
    }

    // 🟣 Handle multipart (text ± image)
    if (type.includes("multipart/form-data")) {
      const form = await req.formData();
      const messages = JSON.parse(form.get("messages") || "[]");
      const file = form.get("file");
      const userMsg = messages.at(-1)?.content || "";

      // if no file or empty file, just text mode
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
        messages: [
          {
            role: "system",
            content:
              "You are VisuaRealm — an AI that can analyze uploaded images and respond clearly in Markdown.",
          },
          ...messages,
          {
            role: "user",
            content: [
              { type: "text", text: `Analyze this image and help with: ${userMsg}` },
              { type: "image_url", image_url: dataUrl },
            ],
          },
        ],
      });

      const reply =
        completion.choices?.[0]?.message?.content?.trim() ||
        "⚠️ No analysis produced.";
      return json(reply);
    }

    // 🚫 Anything else
    return json("⚠️ Unsupported request type.", 400);
  } catch (err) {
    console.error("❌ Chat route error:", err);
    return json(
      `⚠️ ${err.message || "Server error. Please try again later."}`,
      500
    );
  }
}

// --- Helpers ------------------------------------------------------------

async function handleText(messages = []) {
  const completion = await client.chat.completions.create({
    model: "gpt-4o-mini",
    temperature: 0.7,
    messages: [
      {
        role: "system",
        content:
          "You are VisuaRealm — an intelligent assistant. Use Markdown and fenced code blocks for any code.",
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

import OpenAI from "openai";
export const runtime = "nodejs";

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function POST(req) {
  try {
    const type = req.headers.get("content-type") || "";

    // 🧠 JSON-only (normal chat)
    if (type.includes("application/json")) {
      const { messages } = await req.json();
      return await handleUniversal(messages);
    }

    // 🖼 Multipart (chat + image)
    if (type.includes("multipart/form-data")) {
      const form = await req.formData();
      const messages = JSON.parse(form.get("messages") || "[]");
      const file = form.get("file");

      // Vercel-safe check
      if (!file || typeof file.arrayBuffer !== "function") {
        return await handleUniversal(messages);
      }

      // Convert to base64
      const buffer = Buffer.from(await file.arrayBuffer());
      const mime = file.type || "image/png";
      const dataUrl = `data:${mime};base64,${buffer.toString("base64")}`;

      return await handleUniversal(messages, dataUrl);
    }

    return json("⚠️ Unsupported request type.", 400);
  } catch (err) {
    console.error("❌ Universal route error:", err);
    return json(`⚠️ ${err.message || "Server error."}`, 500);
  }
}

/* ------------------ Core Logic ------------------ */

async function handleUniversal(messages = [], image = null) {
  const last = messages.at(-1)?.content?.toLowerCase() || "";
  const context = detectContext(last);
  const mode = detectMode(last);

  // Correct vision block
  const visionBlock = image
    ? [
        {
          role: "user",
          content: [
            { type: "image_url", image_url: { url: image } },
            { type: "text", text: `Analyze this image and assist with: ${last}` },
          ],
        },
      ]
    : [];

  const completion = await client.chat.completions.create({
    model: "gpt-4o-mini",
    temperature: 0.8,
    max_tokens: 1800,
    messages: [
      {
        role: "system",
        content: `
You are **VisuaRealm**, a clean, helpful, safe assistant.

When replying, ALWAYS use:

## 💬 Main Response
## 🧩 Summary
## 🚀 Next Steps

Keep responses factual, useful, and non-hallucinatory.
If given an image, analyze it accurately.
        `.trim(),
      },
      ...messages,
      ...visionBlock,
    ],
  });

  const reply =
    completion.choices?.[0]?.message?.content?.trim() || "⚠️ No response.";

  // Create summary (fixed role)
  const summaryCompletion = await client.chat.completions.create({
    model: "gpt-4o-mini",
    temperature: 0.3,
    max_tokens: 200,
    messages: [
      {
        role: "system",
        content: "Summarize the assistant’s reply in one short paragraph.",
      },
      { role: "user", content: reply },
    ],
  });

  const summary =
    summaryCompletion.choices?.[0]?.message?.content?.trim() ||
    "⚠️ No summary.";

  return json(formatWithContext(context, reply, summary));
}

/* ------------------ Helpers ------------------ */

function detectContext(text = "") {
  if (/(react|js|code|python|api|unreal|ue5|function)/.test(text))
    return "🧠 Programming & Tech";
  if (/(business|startup|money|product|user|marketing)/.test(text))
    return "💼 Business & Strategy";
  if (/(design|image|art|logo|visual)/.test(text))
    return "🎨 Design & Visual";
  if (/(music|guitar|lyrics|song|album)/.test(text))
    return "🎵 Music & Creativity";
  if (/(life|mindset|study|growth)/.test(text))
    return "🌱 Learning & Self-Improvement";
  return "💬 General";
}

function detectMode(text = "") {
  text = text.toLowerCase();
  if (text.includes("code") || text.includes("fix") || text.includes("build"))
    return "⚙️ Code Mode";
  if (text.includes("learn") || text.includes("explain") || text.includes("teach"))
    return "🧠 Learn Mode";
  if (text.includes("idea") || text.includes("plan") || text.includes("insight"))
    return "🎯 Insight Mode";
  return "🧠 Learn Mode";
}

function formatWithContext(context, reply, summary) {
  return `> **${context}**\n\n${reply}\n\n---\n\n📘 **Quick Recap:** ${summary}`;
}

function json(reply, status = 200) {
  return new Response(JSON.stringify({ reply }), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

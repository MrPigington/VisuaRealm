import OpenAI from "openai";
export const runtime = "nodejs";

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function POST(req) {
  try {
    const type = req.headers.get("content-type") || "";

    // 🧠 JSON (Smart Improve or normal chat)
    if (type.includes("application/json")) {
      const { messages } = await req.json();
      return await handleUniversal(messages, null, true);
    }

    // 🖼 Multipart (chat + image)
    if (type.includes("multipart/form-data")) {
      const form = await req.formData();
      const messages = JSON.parse(form.get("messages") || "[]");
      const file = form.get("file");

      // No image → normal response
      if (!(file instanceof File) || !file || file.size === 0) {
        return await handleUniversal(messages);
      }

      // 🔥 FIXED IMAGE LOADING FOR VERCEL/WEB STREAMS
      const arrayBuffer = await file.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);
      const base64 = buffer.toString("base64");
      const mime = file.type || "image/png";

      const dataUrl = `data:${mime};base64,${base64}`;

      return await handleUniversal(messages, dataUrl);
    }

    return json("⚠️ Unsupported request type.", 400);
  } catch (err) {
    console.error("❌ Universal route error:", err);
    return json(`⚠️ ${err.message || "Server error."}`, 500);
  }
}

/* ------------------ Core Logic ------------------ */

async function handleUniversal(messages = [], image = null, allowLong = false) {
  const last = messages.at(-1)?.content?.toLowerCase() || "";
  const context = detectContext(last);
  const mode = detectMode(last);

  const visionBlock = image
    ? [
        {
          role: "user",
          content: [
            { type: "text", text: `Analyze this image and assist with: ${last}` },
            { type: "image_url", image_url: { url: image } },
          ],
        },
      ]
    : [];

  // ⚡ SUPER SMART IMPROVE: context amplification
  const extendedContext =
    allowLong && messages.length > 1
      ? `
RECENT CHAT CONTEXT:
${messages
  .slice(-8)
  .map((m) => `${m.role.toUpperCase()}: ${m.content}`)
  .join("\n")}

INSTRUCTIONS FOR IMPROVEMENT:
- Expand logically and meaningfully.
- Correct errors without altering meaning.
- Preserve voice/tone unless unclear.
- Follow user's direction if implied.
- Avoid adding unrelated info.
- If the text is code, fix + optimize + explain internally.
`
      : "";

  const completion = await client.chat.completions.create({
    model: "gpt-4o-mini",
    temperature: allowLong ? 0.4 : 0.8,
    max_tokens: allowLong ? 6000 : 1600,
    messages: [
      {
        role: "system",
        content: `
You are **VisuaRealm**, an adaptive AI assistant helping users with code, writing, design, reasoning, and creative tasks.

If the request appears to be NOTE IMPROVEMENT or REWRITE:
- Output ONLY the improved content. 
- Do NOT add headers, sections, or commentary.
- Keep user meaning exactly.
- If content includes code, fix issues + optimize structure.
- Stay in Markdown unless the user gave another format.

If the request is normal chat:
Use the structure:
## 💬 Main Response
## 🧩 Summary
## 🚀 Next Steps

Modes:
${mode}

Context:
${context}

${extendedContext}
`.trim(),
      },
      ...messages,
      ...visionBlock,
    ],
  });

  const reply = completion.choices?.[0]?.message?.content?.trim() || "⚠️ No response.";

  // 🔥 Smart Improve returns ONLY improved content
  if (allowLong) return json(reply);

  // 🧩 Summary for normal chats
  const summaryCompletion = await client.chat.completions.create({
    model: "gpt-4o-mini",
    temperature: 0.4,
    max_tokens: 250,
    messages: [
      {
        role: "system",
        content: "Summarize the assistant response in one short, clear paragraph.",
      },
      { role: "assistant", content: reply },
    ],
  });

  const summary =
    summaryCompletion.choices?.[0]?.message?.content?.trim() ??
    "⚠️ No summary generated.";

  return json(formatWithContext(context, reply, summary));
}

/* ------------------ Helper Functions ------------------ */

function detectContext(text = "") {
  if (/(react|js|code|function|api|python|c\+\+|html|css|unreal|ue5)/.test(text))
    return "🧠 Programming & Tech";
  if (/(business|marketing|startup|money|product|app|user)/.test(text))
    return "💼 Business & Strategy";
  if (/(design|image|color|art|logo|visual)/.test(text))
    return "🎨 Design & Visual";
  if (/(music|guitar|lyrics|song|album|mix|audio)/.test(text))
    return "🎵 Music & Creativity";
  if (/(life|mindset|learning|study|growth|focus)/.test(text))
    return "🌱 Learning & Self-Improvement";
  return "💬 General";
}

function detectMode(text = "") {
  text = text.toLowerCase();
  if (text.includes("code") || text.includes("build") || text.includes("fix"))
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

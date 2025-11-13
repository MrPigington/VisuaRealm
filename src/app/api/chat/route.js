import OpenAI from "openai";
export const runtime = "nodejs";

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function POST(req) {
  try {
    const type = req.headers.get("content-type") || "";

    // 🧠 Handle JSON (Smart Improve + normal chat)
    if (type.includes("application/json")) {
      const { messages } = await req.json();
      return await handleUniversal(messages, null, true); // ✅ Allow long Smart Improve
    }

    // 🖼 Handle multipart (chat + image)
    if (type.includes("multipart/form-data")) {
      const form = await req.formData();
      const messages = JSON.parse(form.get("messages") || "[]");
      const file = form.get("file");

      if (!(file instanceof File) || file.size === 0) {
        return await handleUniversal(messages);
      }

      // Convert to base64 for GPT-4o Vision
      const buf = await streamToBuffer(file.stream());
      const base64 = Buffer.from(buf).toString("base64");
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

  const completion = await client.chat.completions.create({
    model: "gpt-4o-mini",
    temperature: 0.8,
    max_tokens: allowLong ? 4000 : 1500, // ✅ Bigger for Smart Improve
    messages: [
      {
        role: "system",
        content: `
You are **VisuaRealm**, an adaptive AI assistant that helps users with code, writing, design, and reasoning.

If the user gives a note or text block:
- Rewrite or improve it contextually using concise Markdown.
- Preserve formatting, meaning, and intent — never hallucinate unrelated topics.

If the user is chatting normally:
- Follow your standard assistant format with sections.

Modes:
${mode}

Context:
${context}

When improving text, output **only** the improved text (no explanation).
When chatting, use this structure:
## 💬 Main Response
## 🧩 Summary
## 🚀 Next Steps
        `.trim(),
      },
      ...messages,
      ...visionBlock,
    ],
  });

  const reply = completion.choices?.[0]?.message?.content?.trim() || "⚠️ No response.";

  // 🧠 Skip summary for Smart Improve (already long-form)
  if (allowLong) return json(reply);

  // 🧩 Otherwise summarize
  const summaryCompletion = await client.chat.completions.create({
    model: "gpt-4o-mini",
    temperature: 0.4,
    max_tokens: 200,
    messages: [
      {
        role: "system",
        content: "Summarize the most recent assistant response in one clear, short paragraph.",
      },
      { role: "assistant", content: reply },
    ],
  });

  const summary =
    summaryCompletion.choices?.[0]?.message?.content?.trim() || "⚠️ No summary generated.";

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
  if (text.includes("code") || text.includes("build") || text.includes("fix")) return "⚙️ Code Mode";
  if (text.includes("learn") || text.includes("explain") || text.includes("teach")) return "🧠 Learn Mode";
  if (text.includes("idea") || text.includes("plan") || text.includes("insight")) return "🎯 Insight Mode";
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

async function streamToBuffer(readable) {
  const chunks = [];
  for await (const chunk of readable) chunks.push(chunk);
  return Buffer.concat(chunks);
}

import OpenAI from "openai";
export const runtime = "nodejs";

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function POST(req) {
  try {
    const type = req.headers.get("content-type") || "";

    // 🧠 Handle JSON (text only)
    if (type.includes("application/json")) {
      const { messages } = await req.json();
      return await handleUniversal(messages);
    }

    // 🖼 Handle multipart (text + image)
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

async function handleUniversal(messages = [], image = null) {
  const last = messages.at(-1)?.content?.toLowerCase() || "";
  const context = detectContext(last);
  const mode = detectMode(last);

  const visionBlock = image
    ? [
        {
          role: "user",
          content: [
            { type: "text", text: `Analyze this image and help with: ${last}` },
            { type: "image_url", image_url: { url: image } },
          ],
        },
      ]
    : [];

  // 🔹 Main response
  const completion = await client.chat.completions.create({
    model: "gpt-4o-mini",
    temperature: 0.8,
    max_tokens: 1400,
    messages: [
      {
        role: "system",
        content: `
You are VisuaRealm — a friendly, intelligent mentor that helps users learn and build anything.

Current Mode: ${mode}
Context: ${context}

Always respond in this format, even if it's code, design, or advice:

## 💬 Main Response
(Detailed, visual or code-rich explanation using Markdown and code fences.)

## 🧩 Summary
(Brief recap of the most important points in bullet form.)

## 🚀 Next Steps
(Encouraging, practical guidance on what to try, learn, or improve next.)

Tone:
- Be supportive, clear, and conversational — never robotic.
- Explain WHY something works, not just WHAT it does.
- For code: include syntax-highlighted examples and reasoning.
- For design or life questions: end with insight or motivation.
        `.trim(),
      },
      ...messages,
      ...visionBlock,
    ],
  });

  const reply = completion.choices?.[0]?.message?.content?.trim() || "⚠️ No response.";

  // 🔹 Auto summary generation
  const summaryCompletion = await client.chat.completions.create({
    model: "gpt-4o-mini",
    temperature: 0.4,
    max_tokens: 200,
    messages: [
      {
        role: "system",
        content: "Summarize the most recent assistant response into one clear and short paragraph.",
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

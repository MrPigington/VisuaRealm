import OpenAI from "openai";
export const runtime = "nodejs";

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function POST(req) {
  try {
    const type = req.headers.get("content-type") || "";

    // 🧠 Detect message type
    if (type.includes("application/json")) {
      const { messages } = await req.json();
      return await handleUniversal(messages);
    }

    if (type.includes("multipart/form-data")) {
      const form = await req.formData();
      const messages = JSON.parse(form.get("messages") || "[]");
      const file = form.get("file");

      if (!(file instanceof File) || file.size === 0) {
        return await handleUniversal(messages);
      }

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
  // 🧠 Detect general intent of last message
  const last = messages.at(-1)?.content?.toLowerCase() || "";
  const context = detectContext(last);

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

  const completion = await client.chat.completions.create({
    model: "gpt-4o-mini",
    temperature: 0.8,
    max_tokens: 1400,
    messages: [
      {
        role: "system",
        content: `
You are VisuaRealm — a friendly, intelligent mentor that helps users learn and build anything.
Always respond in this format, even if it's code, design, or advice:

## 💬 Main Response
(Detailed, visual or code-rich explanation using Markdown and code fences.)

## 🧩 Summary
(Brief recap of the most important points in bullet form.)

## 🚀 Next Steps
(Encouraging, practical guidance on what to try, learn, or improve next.)

Make your tone supportive, clear, and a bit human — never robotic.  
Always explain **why** something works, not just what it does.  
If the question is code-related, include syntax-highlighted examples and explanations.  
If it’s real-world, end with motivation or a useful insight.`,
      },
      ...messages,
      ...visionBlock,
    ],
  });

  const reply = completion.choices?.[0]?.message?.content?.trim() || "⚠️ No response.";
  return json(formatWithContext(context, reply));
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

function formatWithContext(context, reply) {
  return `> **${context}**\n\n${reply}`;
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

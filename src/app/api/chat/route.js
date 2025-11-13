import OpenAI from "openai";
export const runtime = "nodejs";

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

/* ------------------------------ MODEL LOGIC ------------------------------ */

function chooseModel(userText = "", hasImage = false) {
  const t = userText.toLowerCase();

  if (hasImage) return "gpt-4o"; // vision-quality

  // Code-heavy → use deep model
  if (
    t.includes("code") ||
    t.includes("fix") ||
    t.includes("build") ||
    t.includes("unity") ||
    t.includes("java") ||
    t.includes("c#") ||
    t.includes("c++") ||
    t.includes("engine") ||
    t.includes("game") ||
    t.includes("python") ||
    t.includes("unreal")
  ) {
    return "gpt-4o"; // full power
  }

  // Normal conversation → cheap model
  return "gpt-4o-mini";
}

/* ------------------------------ HELPERS ------------------------------ */

function detectContext(text = "") {
  if (/(react|js|code|python|api|unreal|ue5|function)/i.test(text))
    return "🧠 Programming & Tech";
  if (/(business|startup|money|marketing|users)/i.test(text))
    return "💼 Business & Strategy";
  if (/(design|image|art|logo|visual|ui)/i.test(text))
    return "🎨 Design & Visual";
  if (/(music|guitar|song|lyrics|album)/i.test(text))
    return "🎵 Music & Creativity";
  if (/(life|mindset|study|growth|improve)/i.test(text))
    return "🌱 Learning & Self-Improvement";
  return "💬 General";
}

function formatReply(context, main, summary) {
  return `> **${context}**\n\n${main}\n\n---\n\n📘 **Quick Recap:** ${summary}`;
}

function json(data, status = 200) {
  return new Response(JSON.stringify({ reply: data }), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

/* ------------------------------ MAIN HANDLER ------------------------------ */

export async function POST(req) {
  try {
    const type = req.headers.get("content-type") || "";

    if (type.includes("application/json")) {
      const { messages } = await req.json();
      return await handleAll(messages, null);
    }

    if (type.includes("multipart/form-data")) {
      const form = await req.formData();
      const messages = JSON.parse(form.get("messages") || "[]");
      const file = form.get("file");

      if (!file || typeof file.arrayBuffer !== "function")
        return await handleAll(messages, null);

      const buffer = Buffer.from(await file.arrayBuffer());
      const mime = file.type || "image/png";
      const img = `data:${mime};base64,${buffer.toString("base64")}`;

      return await handleAll(messages, img);
    }

    return json("⚠️ Unsupported request type.", 400);
  } catch (err) {
    console.error("❌ API Error:", err);
    return json("⚠️ Server error.", 500);
  }
}

/* ------------------------------ CORE LOGIC ------------------------------ */

async function handleAll(messages = [], image = null) {
  const lastUser = messages.at(-1)?.content || "";
  const context = detectContext(lastUser);
  const model = chooseModel(lastUser, !!image);

  const visionBlock = image
    ? [
        {
          role: "user",
          content: [
            { type: "image_url", image_url: { url: image } },
            { type: "text", text: lastUser },
          ],
        },
      ]
    : [];

  const completion = await client.chat.completions.create({
    model,
    temperature: 0.8,
    max_tokens: 2500,
    messages: [
      {
        role: "system",
        content: `
You are **VisuaRealm**, a clean, intelligent assistant that responds with:
## 💬 Main Response
## 🧩 Summary
## 🚀 Next Steps
No unnecessary filler. No hallucination.
Keep output extremely clear, helpful, and structured.
        `.trim(),
      },
      ...messages,
      ...visionBlock,
    ],
  });

  const mainReply =
    completion.choices?.[0]?.message?.content?.trim() ||
    "⚠️ No response.";

  const summaryCompletion = await client.chat.completions.create({
    model: "gpt-4o-mini",
    temperature: 0.4,
    max_tokens: 150,
    messages: [
      { role: "system", content: "Summarize the assistant's reply." },
      { role: "user", content: mainReply },
    ],
  });

  const summary =
    summaryCompletion.choices?.[0]?.message?.content?.trim() ||
    "No summary.";

  return json(formatReply(context, mainReply, summary));
}

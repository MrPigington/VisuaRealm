import OpenAI from "openai";

export const runtime = "nodejs";

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function POST(req) {
  try {
    const contentType = req.headers.get("content-type") || "";

    // 🟢 Handle plain JSON text chats
    if (contentType.includes("application/json")) {
      const { messages } = await req.json();
      return await handleText(messages);
    }

    // 🟣 Handle multipart form (text ± file)
    if (contentType.includes("multipart/form-data")) {
      const formData = await req.formData();
      const messages = JSON.parse(formData.get("messages") || "[]");
      const file = formData.get("file");
      const userMessage = messages.at(-1)?.content || "";

      // 🔸 If no file or empty file → just use text mode
      if (!(file instanceof File) || file.size === 0) {
        console.log("🟢 No file uploaded — text-only mode");
        return await handleText(messages);
      }

      // 🖼 Convert file → data URL
      const arrayBuffer = await file.arrayBuffer();
      const base64 = Buffer.from(arrayBuffer).toString("base64");
      const mimeType = file.type || "image/png";
      const dataUrl = `data:${mimeType};base64,${base64}`;

      // 🤖 GPT-4o Vision response
      const completion = await client.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content:
              "You are VisuaRealm — an AI that can visually analyze uploaded images and describe them clearly in Markdown.",
          },
          ...messages,
          {
            role: "user",
            content: [
              { type: "text", text: `Analyze this image and assist with: ${userMessage}` },
              { type: "image_url", image_url: dataUrl },
            ],
          },
        ],
      });

      const reply =
        completion.choices?.[0]?.message?.content?.trim() ||
        "⚠️ No image analysis produced.";

      return json(reply);
    }

    // Unsupported type
    return json("⚠️ Unsupported request type.", 400);
  } catch (err) {
    console.error("❌ Chat route error:", err);
    return json("⚠️ Server error. Please try again later.", 500);
  }
}

// ✳️ Helper for text-only chat
async function handleText(messages = []) {
  const completion = await client.chat.completions.create({
    model: "gpt-4o-mini",
    temperature: 0.7,
    messages: [
      {
        role: "system",
        content:
          "You are VisuaRealm — an intelligent AI assistant. Use Markdown and fenced code blocks for any code examples.",
      },
      ...messages,
    ],
  });

  const reply =
    completion.choices?.[0]?.message?.content?.trim() || "⚠️ No response generated.";
  return json(reply);
}

// 🧩 Utility for consistent responses
function json(reply, status = 200) {
  return new Response(JSON.stringify({ reply }), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

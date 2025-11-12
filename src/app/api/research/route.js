import OpenAI from "openai";

export const runtime = "nodejs"; // ✅ Required for file buffers on Vercel

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function POST(req) {
  try {
    const contentType = req.headers.get("content-type") || "";

    // ✅ Check for image upload form
    if (contentType.includes("multipart/form-data")) {
      const formData = await req.formData();
      const messages = JSON.parse(formData.get("messages") || "[]");
      const file = formData.get("file");
      const userMessage = messages[messages.length - 1]?.content || "";

      // If no file, fallback to text-only logic below
      if (!file) {
        console.log("🟢 No file uploaded, running text-only mode.");
        return await handleText(messages);
      }

      // ✅ Convert file to base64 for GPT-4o Vision
      const arrayBuffer = await file.arrayBuffer();
      const base64 = Buffer.from(arrayBuffer).toString("base64");
      const mimeType = file.type || "image/png";
      const imageData = `data:${mimeType};base64,${base64}`;

      console.log("🖼 Uploaded image:", file.name, file.size, "bytes");

      // 🧠 GPT-4o Vision analysis
      const completion = await client.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content:
              "You are VisuaRealm — a refined AI that analyzes uploaded images. Be clear and visual in Markdown.",
          },
          ...messages,
          {
            role: "user",
            content: [
              { type: "text", text: `Analyze this image and help with: ${userMessage}` },
              { type: "image_url", image_url: imageData },
            ],
          },
        ],
      });

      const reply =
        completion.choices?.[0]?.message?.content?.trim() ||
        "⚠️ Could not analyze the image.";

      return json(reply);
    }

    // ✅ Handle normal chat text (JSON)
    if (contentType.includes("application/json")) {
      const { messages } = await req.json();
      return await handleText(messages);
    }

    return json("⚠️ Unsupported request type.", 400);
  } catch (err) {
    console.error("❌ Chat route error:", err);
    return json("⚠️ Server error. Try again later.", 500);
  }
}

// 🧩 Helper for text-only chats
async function handleText(messages) {
  const completion = await client.chat.completions.create({
    model: "gpt-4o-mini",
    temperature: 0.7,
    messages: [
      {
        role: "system",
        content:
          "You are VisuaRealm — an intelligent, creative assistant. Respond cleanly in Markdown.",
      },
      ...messages,
    ],
  });

  const reply =
    completion.choices?.[0]?.message?.content?.trim() ||
    "⚠️ No response generated.";

  return json(reply);
}

// 🔧 Utility for JSON responses
function json(reply, status = 200) {
  return new Response(JSON.stringify({ reply }), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

import OpenAI from "openai";
import { writeFile } from "fs/promises";
import path from "path";

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function POST(req) {
  try {
    const formData = await req.formData();
    const messagesRaw = formData.get("messages");
    const messages = messagesRaw ? JSON.parse(messagesRaw) : [];
    const file = formData.get("file");

    if (!messages.length && !file)
      return new Response(
        JSON.stringify({ reply: "⚠️ No messages or files found." }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );

    // 🧠 Build base messages
    const systemPrompt = {
      role: "system",
      content: `
You are VisuaRealm — an intelligent, visually-aware AI.
Respond in Markdown, use code blocks for code, and describe images clearly when provided.
      `,
    };

    const chatMessages = [systemPrompt, ...messages];

    // 🖼️ If an image file was uploaded
    if (file && file.type.startsWith("image/")) {
      // Save to /tmp for reference (optional)
      const bytes = await file.arrayBuffer();
      const buffer = Buffer.from(bytes);
      const filePath = path.join("/tmp", file.name);
      await writeFile(filePath, buffer);

      // Convert to Base64 for GPT-4o
      const base64Image = buffer.toString("base64");
      const imageUrl = `data:${file.type};base64,${base64Image}`;

      chatMessages.push({
        role: "user",
        content: [
          { type: "text", text: "Analyze this image carefully." },
          { type: "image_url", image_url: imageUrl },
        ],
      });
    }

    // 💬 Send to GPT-4o-mini (multimodal)
    const completion = await client.chat.completions.create({
      model: "gpt-4o-mini",
      messages: chatMessages,
      temperature: 0.7,
    });

    const reply =
      completion.choices?.[0]?.message?.content?.trim() ||
      "⚠️ No response received from model.";

    return new Response(JSON.stringify({ reply }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("❌ Chat route error:", err);
    return new Response(
      JSON.stringify({
        reply: "⚠️ Server error. Please try again later.",
      }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}

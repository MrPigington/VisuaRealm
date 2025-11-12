import OpenAI from "openai";

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export const runtime = "edge"; // ✅ Speeds up image parsing on Vercel

export async function POST(req) {
  try {
    const contentType = req.headers.get("content-type") || "";

    // 🟣 Handle multipart (image upload)
    if (contentType.includes("multipart/form-data")) {
      const formData = await req.formData();
      const messages = JSON.parse(formData.get("messages") || "[]");
      const file = formData.get("file");

      if (!file) {
        return new Response(JSON.stringify({ reply: "⚠️ No file uploaded." }), {
          status: 400,
          headers: { "Content-Type": "application/json" },
        });
      }

      // ✅ Validate image size (under ~10 MB)
      if (file.size > 10 * 1024 * 1024) {
        return new Response(
          JSON.stringify({ reply: "⚠️ Image too large. Try a smaller one (<10MB)." }),
          { status: 400, headers: { "Content-Type": "application/json" } }
        );
      }

      // Convert to base64
      const buffer = Buffer.from(await file.arrayBuffer());
      const mimeType = file.type || "image/png";
      const base64 = buffer.toString("base64");
      const imageData = `data:${mimeType};base64,${base64}`;

      // 🧠 GPT Vision
      const completion = await client.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content:
              "You are VisuaRealm — a helpful assistant that can analyze and describe uploaded images in detail. Use Markdown and stay concise.",
          },
          ...messages,
          {
            role: "user",
            content: [
              { type: "text", text: "Please analyze this image and explain it briefly." },
              { type: "image_url", image_url: imageData },
            ],
          },
        ],
      });

      const reply =
        completion.choices?.[0]?.message?.content?.trim() ||
        "⚠️ No analysis could be generated.";

      return new Response(JSON.stringify({ reply }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }

    // 🟢 Handle JSON (text-only)
    if (contentType.includes("application/json")) {
      const { messages } = await req.json();

      const completion = await client.chat.completions.create({
        model: "gpt-4o-mini",
        temperature: 0.7,
        messages: [
          {
            role: "system",
            content:
              "You are VisuaRealm — an intelligent, expressive assistant. Always respond in Markdown and structure clearly.",
          },
          ...messages,
        ],
      });

      const reply =
        completion.choices?.[0]?.message?.content?.trim() || "⚠️ No response generated.";
      return new Response(JSON.stringify({ reply }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ reply: "⚠️ Unsupported request type." }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("❌ Chat route error:", err);
    return new Response(
      JSON.stringify({
        reply: "⚠️ Server error — AI couldn’t process your message. Try again.",
      }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}

import OpenAI from "openai";

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function POST(req) {
  try {
    const contentType = req.headers.get("content-type") || "";

    // 🟢 JSON request (text only)
    if (contentType.includes("application/json")) {
      const { messages } = await req.json();

      const completion = await client.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content:
              "You are VisuaRealm — an intelligent and visually refined AI assistant. Use Markdown, and fenced code blocks for any code.",
          },
          ...messages,
        ],
      });

      const reply = completion.choices?.[0]?.message?.content?.trim() || "No response.";
      return new Response(JSON.stringify({ reply }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }

    // 🟣 Multipart request (text + file upload)
    if (contentType.includes("multipart/form-data")) {
      const formData = await req.formData();
      const messages = JSON.parse(formData.get("messages"));
      const file = formData.get("file");

      if (!file) {
        return new Response(JSON.stringify({ reply: "⚠️ No file uploaded." }), {
          status: 400,
          headers: { "Content-Type": "application/json" },
        });
      }

      // Convert file → Base64 string
      const arrayBuffer = await file.arrayBuffer();
      const base64 = Buffer.from(arrayBuffer).toString("base64");
      const mimeType = file.type || "image/png";
      const dataUrl = `data:${mimeType};base64,${base64}`;

      // 🔥 Send image to GPT-4o Vision
      const completion = await client.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content:
              "You are VisuaRealm — an AI that can analyze and describe uploaded images. Respond in Markdown.",
          },
          ...messages,
          {
            role: "user",
            content: [
              { type: "text", text: messages[messages.length - 1]?.content || "Analyze this image." },
              { type: "image_url", image_url: dataUrl },
            ],
          },
        ],
      });

      const reply = completion.choices?.[0]?.message?.content?.trim() || "⚠️ No analysis produced.";
      return new Response(JSON.stringify({ reply }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ reply: "Unsupported request type." }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("❌ Chat route error:", err);
    return new Response(
      JSON.stringify({ reply: "⚠️ Server error. Please try again later." }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}

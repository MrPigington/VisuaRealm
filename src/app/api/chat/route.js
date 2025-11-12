import OpenAI from "openai";

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function POST(req) {
  try {
    const contentType = req.headers.get("content-type") || "";

    // 🟢 Text-only request
    if (contentType.includes("application/json")) {
      const { messages } = await req.json();

      const completion = await client.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content:
              "You are VisuaRealm — a creative, visual, and intelligent AI assistant. Format with Markdown and use code blocks when needed.",
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

    // 🟣 File + message upload
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

      // Convert image to base64 string
      const arrayBuffer = await file.arrayBuffer();
      const base64 = Buffer.from(arrayBuffer).toString("base64");
      const mimeType = file.type || "image/png";
      const dataUrl = `data:${mimeType};base64,${base64}`;

      // 🔥 Send image and user text to GPT-4o for reasoning
      const completion = await client.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content:
              "You are VisuaRealm — an assistant that can see and understand images. Describe, analyze, or interpret them based on user context.",
          },
          ...messages,
          {
            role: "user",
            content: [
              { type: "text", text: messages[messages.length - 1]?.content || "" },
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

    // Unknown request type
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

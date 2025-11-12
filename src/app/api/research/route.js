import OpenAI from "openai";

export const runtime = "nodejs"; // ✅ Correct way for Next.js App Router

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

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

      // ✅ Convert image to base64 safely
      const arrayBuffer = await file.arrayBuffer();
      const base64 = Buffer.from(arrayBuffer).toString("base64");
      const mimeType = file.type || "image/png";
      const imageData = `data:${mimeType};base64,${base64}`;

      console.log("🖼 Image uploaded, size:", file.size, "bytes");

      // 🧠 GPT-4o Vision (analyzes image)
      const completion = await client.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content:
              "You are VisuaRealm — a helpful AI that analyzes uploaded images. Always answer in Markdown.",
          },
          ...messages,
          {
            role: "user",
            content: [
              { type: "text", text: "Analyze and describe this image clearly." },
              { type: "image_url", image_url: imageData },
            ],
          },
        ],
      });

      const reply =
        completion.choices?.[0]?.message?.content?.trim() ||
        "⚠️ Could not analyze this image.";

      return new Response(JSON.stringify({ reply }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }

    // 🟢 Handle text messages
    if (contentType.includes("application/json")) {
      const { messages } = await req.json();

      const completion = await client.chat.completions.create({
        model: "gpt-4o-mini",
        temperature: 0.7,
        messages: [
          {
            role: "system",
            content:
              "You are VisuaRealm — an intelligent assistant. Respond cleanly, structured, in Markdown.",
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
        reply: "⚠️ Server error — image could not be processed. Try again with a smaller file.",
      }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}

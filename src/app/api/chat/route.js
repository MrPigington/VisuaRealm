import OpenAI from "openai";

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function POST(req) {
  try {
    const contentType = req.headers.get("content-type") || "";
    const isMultipart = contentType.includes("multipart/form-data");

    let messages = [];
    let file = null;

    if (isMultipart) {
      const formData = await req.formData();
      const fileData = formData.get("file");
      const msgData = formData.get("messages");
      if (msgData) messages = JSON.parse(msgData);
      if (fileData && fileData.size > 0) file = fileData;
    } else {
      const body = await req.json();
      messages = body?.messages || [];
    }

    if (!Array.isArray(messages) || messages.length === 0) {
      return new Response(
        JSON.stringify({ reply: "⚠️ No messages provided." }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    const userMessage = messages[messages.length - 1]?.content || "";

    // 🔍 If there’s a file, describe or summarize it
    let fileContext = "";
    if (file) {
      const mimeType = file.type || "application/octet-stream";
      const arrayBuffer = await file.arrayBuffer();
      const base64 = Buffer.from(arrayBuffer).toString("base64");

      if (mimeType.startsWith("image/")) {
        // 🧠 Use GPT-4o vision to describe the image
        const visionRes = await client.chat.completions.create({
          model: "gpt-4o-mini",
          messages: [
            {
              role: "user",
              content: [
                { type: "text", text: "Describe and analyze this image clearly." },
                {
                  type: "image_url",
                  image_url: `data:${mimeType};base64,${base64}`,
                },
              ],
            },
          ],
        });
        fileContext =
          visionRes.choices?.[0]?.message?.content?.trim() ||
          "⚠️ Could not analyze image.";
      } else {
        // 🧠 For text/doc files — extract and summarize content
        const textContent = Buffer.from(base64, "base64").toString("utf-8").slice(0, 2000);
        const textSummary = await client.chat.completions.create({
          model: "gpt-4o-mini",
          messages: [
            {
              role: "system",
              content:
                "Summarize this file content in a short, readable way. Detect language automatically.",
            },
            { role: "user", content: textContent },
          ],
        });
        fileContext =
          textSummary.choices?.[0]?.message?.content?.trim() ||
          "⚠️ Could not summarize file.";
      }
    }

    // 🧠 Core response logic
    const completion = await client.chat.completions.create({
      model: "gpt-4o-mini",
      temperature: 0.7,
      messages: [
        {
          role: "system",
          content: `
You are VisuaRealm — a refined, visually intelligent AI assistant.
Always respond in Markdown.
Use code blocks (""") for code.
Be concise, structured, and helpful.
If an image or file context is provided, reference it naturally in your answer.`,
        },
        ...(fileContext
          ? [{ role: "assistant", content: `📎 File analysis:\n${fileContext}` }]
          : []),
        ...messages,
      ],
    });

    const reply =
      completion.choices?.[0]?.message?.content?.trim() ||
      "⚠️ No response received.";

    return new Response(JSON.stringify({ reply }), {
      status: 200,
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

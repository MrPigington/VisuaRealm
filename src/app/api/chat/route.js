import OpenAI from "openai";

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function POST(req) {
  try {
    // Ensure valid JSON
    const contentType = req.headers.get("content-type") || "";
    if (!contentType.includes("application/json")) {
      return new Response(
        JSON.stringify({ reply: "⚠️ Expected JSON input." }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    const bodyText = await req.text();
    let body;
    try {
      body = JSON.parse(bodyText);
    } catch {
      return new Response(
        JSON.stringify({ reply: "⚠️ Invalid JSON." }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    const messages = body?.messages;
    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return new Response(
        JSON.stringify({ reply: "⚠️ No messages found." }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    // 🔥 Core AI logic
    const completion = await client.chat.completions.create({
      model: "gpt-4o-mini",
      temperature: 0.7,
      messages: [
        {
          role: "system",
          content: `
You are VisuaRealm — an intelligent and visually refined AI assistant.
Always respond using Markdown.
Use fenced code blocks (triple backticks) for any code.
Keep responses organized, readable, and neatly sectioned like ChatGPT.
          `,
        },
        ...messages,
      ],
    });

    let reply = completion.choices?.[0]?.message?.content?.trim() || "";
    if (!reply) reply = "⚠️ No response received from model.";

    // ✅ Make sure it always returns valid JSON
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

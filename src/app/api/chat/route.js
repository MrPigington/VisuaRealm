import OpenAI from "openai";

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function POST(req) {
  try {
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
        JSON.stringify({ reply: "⚠️ No message provided (empty array)." }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    const completion = await client.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content:
            "You are VisuaRealm — a friendly, concise, creative AI that answers clearly using Markdown and fenced code blocks for code.",
        },
        ...messages,
      ],
      temperature: 0.8,
    });

    const reply =
      completion.choices?.[0]?.message?.content?.trim() || "No response.";

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

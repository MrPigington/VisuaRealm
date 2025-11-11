import OpenAI from "openai";

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export async function POST(req) {
  try {
    const { message } = await req.json();

    if (!message || typeof message !== "string") {
      return Response.json({ reply: "⚠️ No message provided." }, { status: 400 });
    }

    const completion = await client.chat.completions.create({
      model: "gpt-4o-mini",
      temperature: 0.7,
      max_tokens: 1200,
      messages: [
        {
          role: "system",
          content: `
You are VisuaRealm — reply like GPT but always send clean markdown.
Use triple backticks for code, never repeat text, no filler like “Certainly”.
Write concise, readable answers formatted for ReactMarkdown.
          `,
        },
        { role: "user", content: message },
      ],
    });

    const reply =
      completion.choices?.[0]?.message?.content?.trim() || "No response received.";
    return Response.json({ reply });
  } catch (err) {
    console.error("Chat route error:", err);
    return Response.json(
      { reply: "⚠️ Server error. Try again later." },
      { status: 500 }
    );
  }
}

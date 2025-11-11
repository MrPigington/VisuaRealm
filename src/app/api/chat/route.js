import OpenAI from "openai";

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function POST(req) {
  try {
    const body = await req.json();
    const { messages } = body;

    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return Response.json({ reply: "⚠️ No message provided." }, { status: 400 });
    }

    const completion = await client.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: "You are VisuaRealm — respond clearly in Markdown, format code properly in boxes.",
        },
        ...messages,
      ],
    });

    const reply = completion.choices?.[0]?.message?.content?.trim() || "No response.";
    return Response.json({ reply });
  } catch (err) {
    console.error("❌ Chat route error:", err);
    return Response.json({ reply: "⚠️ Server error. Please try again." }, { status: 500 });
  }
}

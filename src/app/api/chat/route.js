import OpenAI from "openai";

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function POST(req) {
  try {
    const { message } = await req.json();

    if (!message || typeof message !== "string") {
      return Response.json(
        { reply: "⚠️ No input provided." },
        { status: 400 }
      );
    }

    // Call OpenAI with clean format rules
    const completion = await client.chat.completions.create({
      model: "gpt-4o-mini",
      temperature: 0.7,
      max_tokens: 1200,
      messages: [
        {
          role: "system",
          content: `
You are VisuaRealm, a clear, direct AI assistant. 
Rules:
- Respond like GPT at its best — complete thoughts, no half-sentences.  
- Never duplicate or repeat lines.  
- Never break markdown or code blocks.  
- If showing code, show one clean version only.  
- No “Here is” or “Certainly” filler.  
- Write in readable paragraphs with good spacing.  
- End responses cleanly — no cutoff mid-thought.  
          `,
        },
        { role: "user", content: message },
      ],
    });

    const reply =
      completion.choices?.[0]?.message?.content?.trim() ||
      "No response received.";

    return Response.json({ reply });
  } catch (error) {
    console.error("Chat route error:", error);
    return Response.json(
      { reply: "⚠️ Server error. Try again later." },
      { status: 500 }
    );
  }
}

import OpenAI from "openai";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function POST(req) {
  try {
    const { message } = await req.json();

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: "You are VisuaRealm, an intelligent creative assistant that helps the user brainstorm ideas visually and textually." },
        { role: "user", content: message },
      ],
    });

    const reply = completion.choices[0].message.content;
    return new Response(JSON.stringify({ reply }), { status: 200 });
  } catch (err) {
    console.error(err);
    return new Response(JSON.stringify({ error: "Failed to fetch response" }), { status: 500 });
  }
}

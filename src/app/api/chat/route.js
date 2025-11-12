import OpenAI from "openai";

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function POST(req) {
  try {
    // ✅ Parse JSON safely
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
        JSON.stringify({ reply: "⚠️ Invalid JSON format." }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    const messages = body?.messages || [];
    if (!Array.isArray(messages) || messages.length === 0) {
      return new Response(
        JSON.stringify({ reply: "⚠️ No messages found." }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    const userMessage = messages[messages.length - 1]?.content || "";

    // 🧠 Step 1: Decide if research is needed
    const check = await client.chat.completions.create({
      model: "gpt-4o-mini",
      temperature: 0,
      messages: [
        {
          role: "system",
          content:
            "Answer only with 'yes' or 'no'. Does this query require real-time or factual web research (like recent events, news, or statistics)?",
        },
        { role: "user", content: userMessage },
      ],
    });

    const checkText =
      check.choices?.[0]?.message?.content?.toLowerCase() || "";
    const needsResearch = checkText.includes("yes");
    let researchSummary = "";

    // 🔍 Step 2: Perform DuckDuckGo search if needed
    if (needsResearch) {
      const search = await fetch(
        `https://api.duckduckgo.com/?q=${encodeURIComponent(
          userMessage
        )}&format=json&kl=en-us`
      );
      const data = await search.json();

      const results =
        data?.RelatedTopics?.filter((t) => t.Text && t.FirstURL)
          .slice(0, 5)
          .map((t) => `• [${t.Text}](${t.FirstURL})`)
          .join("\n") || "No sources found.";

      // Summarize search results neatly
      const summary = await client.chat.completions.create({
        model: "gpt-4o-mini",
        temperature: 0.7,
        messages: [
          {
            role: "system",
            content: `
You are a summarizer. Convert raw search data into a short, factual, easy-to-read summary in Markdown. 
End with a "### Sources" list.`,
          },
          { role: "user", content: results },
        ],
      });

      researchSummary =
        summary.choices?.[0]?.message?.content?.trim() || "";
    }

    // 💬 Step 3: Generate final AI response
    const completion = await client.chat.completions.create({
      model: "gpt-4o-mini",
      temperature: 0.7,
      messages: [
        {
          role: "system",
          content: `
You are VisuaRealm — a refined, visually intelligent assistant.
Always respond in Markdown.
Use fenced code blocks (\`\`\`) for any code.
Be concise, clean, and structured like ChatGPT.
If research data exists, use it to inform your answer and show it after your main response.`,
        },
        ...messages,
        ...(researchSummary
          ? [{ role: "assistant", content: `📡 Research Results:\n${researchSummary}` }]
          : []),
      ],
    });

    const reply =
      completion.choices?.[0]?.message?.content?.trim() ||
      "⚠️ No response received from model.";

    return new Response(JSON.stringify({ reply }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("❌ Chat route error:", err);
    return new Response(
      JSON.stringify({
        reply: "⚠️ Server error. Please try again later.",
      }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}

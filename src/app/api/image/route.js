import OpenAI from "openai";
export const runtime = "nodejs";

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function POST(req) {
  try {
    const { prompt } = await req.json();

    if (!prompt || prompt.length < 3) {
      return json({ error: "Prompt too short" }, 400);
    }

    // 🔥 Generate image using gpt-image-1
    const response = await client.images.generate({
      model: "gpt-image-1",
      prompt,
      size: "1024x1024",
    });

    // Extract base64
    const base64 = response.data?.[0]?.b64_json || null;

    if (!base64) {
      return json({ error: "No image returned from API" }, 500);
    }

    // Return data URL
    return json({
      image: `data:image/png;base64,${base64}`,
    });

  } catch (err) {
    console.error("❌ Image route error:", err);
    return json({ error: err.message || "Server error." }, 500);
  }
}

/* ------------------ Helper ------------------ */

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

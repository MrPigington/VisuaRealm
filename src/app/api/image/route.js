import OpenAI from "openai";

export const runtime = "nodejs";

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function POST(req) {
  try {
    const { prompt } = await req.json();

    if (!prompt || prompt.trim().length < 3) {
      return json({ error: "Prompt too short." }, 400);
    }

    // 🚀 Generate image using GPT Image Model
    const response = await client.images.generate({
      model: "gpt-image-1",
      prompt,
      size: "1024x1024",
      response_format: "b64_json", // ✅ REQUIRED OR IT RETURNS NULL
    });

    const base64 = response.data?.[0]?.b64_json;

    if (!base64) {
      console.error("❌ No image from OpenAI:", response);
      return json({ error: "Image generation failed." }, 500);
    }

    return json({
      image: `data:image/png;base64,${base64}`,
    });

  } catch (err) {
    console.error("❌ Image API error:", err);
    return json({ error: err.message || "Server error." }, 500);
  }
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

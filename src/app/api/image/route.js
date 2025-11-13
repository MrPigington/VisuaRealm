import OpenAI from "openai";
export const runtime = "nodejs";

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,   // secure & correct
});

export async function POST(req) {
  try {
    const type = req.headers.get("content-type") || "";

    // Ensure JSON request
    if (!type.includes("application/json")) {
      return json({ error: "Invalid request type. Expected JSON." }, 400);
    }

    const body = await req.json();
    const prompt = body?.prompt || "";

    if (!prompt || prompt.length < 3) {
      return json({ error: "Prompt too short." }, 400);
    }

    // 🔥 Generate image with GPT Image model
    const response = await client.images.generate({
      model: "gpt-image-1",
      prompt,
      size: "1024x1024",
      quality: "high"
    });

    const base64 = response?.data?.[0]?.b64_json;

    if (!base64) {
      return json({ error: "No image returned from OpenAI." }, 500);
    }

    return json({
      image: `data:image/png;base64,${base64}`,
    });

  } catch (err) {
    console.error("❌ /api/image error:", err);
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

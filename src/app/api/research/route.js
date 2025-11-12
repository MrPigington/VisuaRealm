export async function POST(req) {
  return new Response(JSON.stringify({ reply: "Research route active ✅" }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}

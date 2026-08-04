import { serve } from "https://deno.land/std@0.224.0/http/server.ts";

const OPENROUTER_API_KEY = Deno.env.get("OPENROUTER_API_KEY");
const MODEL = Deno.env.get("OPENROUTER_MODEL") ?? "openai/gpt-4o-mini";

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders() });
  }

  try {
    const { contest, tone, personalAngle } = await req.json();
    if (!OPENROUTER_API_KEY) {
      return json({ error: "OPENROUTER_API_KEY is not configured" }, 500);
    }

    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${OPENROUTER_API_KEY}`,
        "Content-Type": "application/json",
        "HTTP-Referer": "https://contest-hunter.local",
        "X-Title": "Contest Hunter"
      },
      body: JSON.stringify({
        model: MODEL,
        messages: [
          {
            role: "system",
            content:
              "You write short, original contest answers. Avoid generic gratitude, copied giveaway phrasing, and overclaiming. Return exactly three distinct answers."
          },
          {
            role: "user",
            content: JSON.stringify({ contest, tone, personalAngle })
          }
        ],
        temperature: 0.9
      })
    });

    if (!response.ok) {
      return json({ error: await response.text() }, response.status);
    }

    const payload = await response.json();
    const content = payload.choices?.[0]?.message?.content ?? "";
    const answers = content
      .split(/\n+/)
      .map((line: string) => line.replace(/^\d+[\).\s-]*/, "").trim())
      .filter(Boolean)
      .slice(0, 3);

    return json({ answers, model: MODEL });
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : "Unknown error" }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders(), "Content-Type": "application/json" }
  });
}

function corsHeaders() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type"
  };
}

import { adminClient, corsHeaders, json, requireUser } from "../_shared/deps.ts";

const MODEL = Deno.env.get("OPENROUTER_MODEL") ?? "openai/gpt-4o-mini";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders() });

  try {
    const { user, error: authError } = await requireUser(req);
    if (!user) return json({ error: authError }, 401);

    // Re-check entitlement here rather than trusting the caller: this endpoint
    // spends real money per request, and the browser's `isPro` is only a hint.
    const admin = adminClient();
    const { data: subscription } = await admin
      .from("subscriptions")
      .select("plan")
      .eq("user_id", user.id)
      .maybeSingle();

    if (subscription?.plan !== "pro") {
      return json({ error: "AI drafts require a Pro subscription." }, 403);
    }

    const apiKey = Deno.env.get("OPENROUTER_API_KEY");
    if (!apiKey) return json({ error: "OPENROUTER_API_KEY is not configured" }, 500);

    const { contest, tone, personalAngle } = await req.json();

    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "HTTP-Referer": Deno.env.get("APP_URL") ?? "https://contest-hunter.local",
        "X-Title": "Contest Hunter"
      },
      body: JSON.stringify({
        model: MODEL,
        messages: [
          {
            role: "system",
            content:
              "You write short, original contest answers. Avoid generic gratitude, copied " +
              "giveaway phrasing, and overclaiming. Return exactly three distinct answers, " +
              "one per line, with no numbering."
          },
          { role: "user", content: JSON.stringify({ contest, tone, personalAngle }) }
        ],
        temperature: 0.9
      })
    });

    if (!response.ok) {
      console.error("OpenRouter error", response.status, await response.text());
      return json({ error: "The answer service is unavailable right now." }, 502);
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
    console.error("generate-answer failed", error);
    return json({ error: "Could not generate answers. Please try again." }, 500);
  }
});

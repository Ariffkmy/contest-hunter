// Idea generation for one contest.
//
// The catalogue is mostly *not* comment giveaways — buy&win, video, design and
// cook&win entries all need different help, so the system prompt is chosen by
// the contest format the client detected. The response shape stays `answers`
// either way: three strings, one per idea.

import { adminClient, corsHeaders, json, requireUser } from "../_shared/deps.ts";

const MODEL = Deno.env.get("OPENROUTER_MODEL") ?? "openai/gpt-4o-mini";

const SHARED_RULES =
  "Return exactly three distinct items, one per line, with no numbering, no markdown and " +
  "no preamble. Each line must stand alone and be specific to this contest — never generic " +
  "giveaway filler, never invented facts about the brand or the prize.";

const PROMPTS: Record<string, string> = {
  text:
    "You write short, original contest answers. Avoid generic gratitude, copied giveaway " +
    "phrasing, and overclaiming. " +
    SHARED_RULES,

  media:
    "You are a short-form content producer helping someone enter a contest that requires " +
    "making something — a video, photo, dish or design. Do not write answers to paste. Each " +
    "line is one concept the person could actually produce today on a phone, with a concrete " +
    "hook, the shots or steps in order, and one sentence on why it beats the obvious entry. " +
    "Respect what they say they can realistically make; never propose a crew, a studio, or " +
    "equipment they have not mentioned. " +
    SHARED_RULES,

  action:
    "You help someone complete a contest that is won by doing rather than writing — a " +
    "purchase, a receipt upload, a share or a registration. Do not write creative copy. Each " +
    "line is practical: the steps in the right order, the proof to keep, or the specific " +
    "technicality that disqualifies entries for this kind of contest. Work only from the " +
    "conditions supplied; if a rule is not stated, tell them to check the post rather than " +
    "guessing it. " +
    SHARED_RULES,

  closed:
    "This post is a winner announcement rather than an open giveaway. Say so plainly in one " +
    "line and stop. Do not invent an entry route."
};

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
      return json({ error: "AI ideas require a Pro subscription." }, 403);
    }

    const apiKey = Deno.env.get("OPENROUTER_API_KEY");
    if (!apiKey) return json({ error: "OPENROUTER_API_KEY is not configured" }, 500);

    const { contest, tone, personalAngle, format } = await req.json();
    const systemPrompt = PROMPTS[format] ?? PROMPTS.text;

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
          { role: "system", content: systemPrompt },
          { role: "user", content: JSON.stringify({ contest, tone, personalAngle, format }) }
        ],
        // Concepts benefit from range; a compliance checklist does not.
        temperature: format === "action" ? 0.4 : 0.9
      })
    });

    if (!response.ok) {
      console.error("OpenRouter error", response.status, await response.text());
      return json({ error: "The idea service is unavailable right now." }, 502);
    }

    const payload = await response.json();
    const content = payload.choices?.[0]?.message?.content ?? "";
    const answers = content
      .split(/\n+/)
      .map((line: string) => line.replace(/^\d+[\).\s-]*/, "").trim())
      .filter(Boolean)
      .slice(0, 3);

    return json({ answers, model: MODEL, format: format ?? "text" });
  } catch (error) {
    console.error("generate-answer failed", error);
    return json({ error: "Could not generate ideas. Please try again." }, 500);
  }
});

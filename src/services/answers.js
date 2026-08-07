// Answer generation. Free accounts get the local template writer; Pro accounts
// get real model output from the generate-answer edge function.
//
// The gate here is for UX only — the edge function re-checks the caller's plan
// against the database before spending a token, because anything enforced in
// the browser is a suggestion.

import { supabase } from "./supabaseClient.js";
import { generateAnswerIdeas } from "./answerRecommender.js";

export async function generateIdeas({ contest, tone, personalNote, isPro }) {
  if (!isPro) {
    return { ideas: generateAnswerIdeas(contest, tone, personalNote), model: null, error: null };
  }

  const { data, error } = await supabase.functions.invoke("generate-answer", {
    body: {
      contestId: contest.id,
      contest: { brand: contest.brand, prize: contest.prize, prompt: contest.prompt },
      tone,
      personalAngle: personalNote
    }
  });

  if (error) {
    // Fall back rather than leave the user with nothing, but say what happened.
    return {
      ideas: generateAnswerIdeas(contest, tone, personalNote),
      model: null,
      error: `AI drafts unavailable (${error.message}). Showing template drafts instead.`
    };
  }

  return { ideas: data.answers ?? [], model: data.model ?? null, error: null };
}

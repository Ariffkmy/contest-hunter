// Idea generation. Free accounts get the local template writer; Pro accounts
// get real model output from the generate-answer edge function.
//
// What gets generated depends on the contest format, not just the plan: a video
// giveaway returns concepts, a buy&win returns a checklist. The format is sent
// to the function so the model is briefed the same way the templates are.
//
// The plan gate here is for UX only — the edge function re-checks the caller's
// plan against the database before spending a token, because anything enforced
// in the browser is a suggestion.

import { supabase } from "./supabaseClient.js";
import { generateIdeasFor } from "./answerRecommender.js";
import { detectFormat } from "./contestFormats.js";

export async function generateIdeas({ contest, tone, personalNote, isPro }) {
  const format = detectFormat(contest);

  if (!isPro) {
    return { ideas: generateIdeasFor(contest, tone, personalNote), model: null, error: null };
  }

  const { data, error } = await supabase.functions.invoke("generate-answer", {
    body: {
      contestId: contest.id,
      contest: {
        brand: contest.brand,
        prize: contest.prize,
        prompt: contest.prompt,
        contestType: contest.contestType,
        conditions: contest.conditions,
        deadline: contest.deadline
      },
      format,
      tone,
      personalAngle: personalNote
    }
  });

  if (error) {
    // Fall back rather than leave the user with nothing, but say what happened.
    return {
      ideas: generateIdeasFor(contest, tone, personalNote),
      model: null,
      error: `AI ideas unavailable (${error.message}). Showing template ideas instead.`
    };
  }

  if (data?.error) {
    return {
      ideas: generateIdeasFor(contest, tone, personalNote),
      model: null,
      error: `${data.error} Showing template ideas instead.`
    };
  }

  return { ideas: data.answers ?? [], model: data.model ?? null, error: null };
}

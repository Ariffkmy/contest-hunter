// The free-tier writer. Pro accounts get real model output from the
// generate-answer edge function; these templates are the fallback and the
// preview of what the feature does.
//
// One generator per contest format — a comment giveaway wants sentences, a
// video giveaway wants concepts, and a buy&win wants a checklist.
//
// Tone is deliberately gone: the only thing that made an entry distinctive was
// the personal angle, so the drafts differ by how they frame that angle rather
// than by a Warm/Bold label.

import { detectFormat, FORMATS } from "./contestFormats.js";

const hooks = [
  "I would not treat it like a prize; I would treat it like proof that small upgrades can change the mood of a whole week.",
  "The most useful wins are the ones that quietly remove friction, and this feels exactly like that.",
  "I want this because it matches the version of life I am trying to practice: more intentional, less rushed, and a little more delighted."
];

export function generateAnswerIdeas(contest, personalNote) {
  const cleanNote = String(personalNote ?? "").trim() || "I want a practical win that I will genuinely use.";
  const prizeNoun = String(contest.prize ?? "the prize").toLowerCase();

  return [
    `${hooks[0]} ${cleanNote} For ${contest.brand}, I would make the ${prizeNoun} part of a real routine, then share the before-and-after honestly so the entry feels lived-in, not copied.`,
    `My answer: I need this because "${cleanNote}" is not just a nice sentence, it is the tiny problem I keep meeting in real life. This ${prizeNoun} would solve it in a way that is specific and genuinely useful.`,
    `I deserve it because I would give the prize a story after the giveaway ends. I would show how ${contest.brand} fits into an ordinary day, with the kind of detail that makes people think, "Okay, that was made for her."`
  ];
}

/**
 * Concepts for contests that want something made. Each one is a hook, a shot
 * list and the reason it fits — the three things missing when someone stares
 * at "post a video of you using our product" and has no idea where to start.
 */
export function generateContentIdeas(contest, personalNote) {
  const frame = ["honest", "tender", "specific"];
  const context = personalNote.trim() || "an ordinary day at home, filmed on a phone";
  const prize = contest.prize;
  const brand = contest.brand;

  return [
    `The honest first try — open on the problem, not the product: 5s of the mess or the moment that needs fixing, 10s of ${brand} actually being used, 5s on the result with no voiceover. Shoot it in ${context}. Judges see hundreds of polished clips; an unstaged one that is clearly real reads ${frame[0]} and gets watched to the end.`,

    `The one-take routine — a single unbroken shot of the whole thing start to finish, phone propped up, no cuts. Caption it with the time it took. This is the cheapest concept to produce and the hardest to fake, which is exactly why it stands out in a ${prize} entry pile.`,

    `The before-and-after with a twist — same frame, same angle, two moments hours apart, then one closing beat that shows what changed for *you* rather than for the product. Keep it ${frame[1]}. If the brief allows text on screen, put your one honest sentence there instead of in the caption, so it survives being watched on mute.`
  ];
}

/**
 * Checklists for contests won by doing rather than making. Built from the
 * scraped conditions, because the disqualifier is nearly always a step the
 * entrant skimmed.
 */
export function generateActionPlan(contest) {
  const conditions = Array.isArray(contest.conditions) ? contest.conditions.filter(Boolean) : [];
  const steps = conditions.length
    ? conditions.map((condition, index) => `${index + 1}. ${condition}`).join(" ")
    : "No conditions were scraped from this post — open it and read the rules before entering.";

  return [
    `Do it in order, and screenshot as you go: ${steps}`,

    `Keep the proof. For anything involving a receipt or a transaction, photograph it the same day — the number one reason entries get voided is a receipt that was thrown away, cropped, or dated outside the contest window. Check ${contest.deadline || "the closing date"} against the date on your proof before you submit.`,

    `Check the quiet rules on the post itself: whether the account has to be public, whether tagged friends must be real accounts, whether one person may enter more than once, and whether ${contest.brand} restricts entries to certain states or outlets. These are rarely in the caption headline and are the usual grounds for pulling a winner.`
  ];
}

/** Dispatches to the right template writer for the contest's format. */
export function generateIdeasFor(contest, personalNote) {
  switch (detectFormat(contest)) {
    case FORMATS.MEDIA:
      return generateContentIdeas(contest, personalNote);
    case FORMATS.ACTION:
      return generateActionPlan(contest);
    case FORMATS.CLOSED:
      return [
        "This post looks like a winner announcement rather than an open giveaway. Nothing to enter — delete it from your board if it is cluttering the list."
      ];
    default:
      return generateAnswerIdeas(contest, personalNote);
  }
}

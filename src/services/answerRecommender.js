const toneFrames = {
  Warm: ["honest", "tender", "specific"],
  Funny: ["playful", "slightly cheeky", "memorable"],
  Premium: ["polished", "sensory", "aspirational"],
  Bold: ["confident", "punchy", "clear"]
};

const hooks = [
  "I would not treat it like a prize; I would treat it like proof that small upgrades can change the mood of a whole week.",
  "The most useful wins are the ones that quietly remove friction, and this feels exactly like that.",
  "I want this because it matches the version of life I am trying to practice: more intentional, less rushed, and a little more delighted."
];

export function generateAnswerIdeas(contest, tone, personalNote) {
  const frame = toneFrames[tone] ?? toneFrames.Warm;
  const cleanNote = personalNote.trim() || "I want a practical win that I will genuinely use.";
  const prizeNoun = contest.prize.toLowerCase();

  return [
    `${hooks[0]} ${cleanNote} For ${contest.brand}, I would make the ${prizeNoun} part of a real routine, then share the before-and-after honestly so the entry feels lived-in, not copied.`,
    `My answer: I need this because "${cleanNote}" is not just a nice sentence, it is the tiny problem I keep meeting in real life. This ${prizeNoun} would solve it in a way that feels ${frame[0]}, ${frame[1]}, and genuinely useful.`,
    `I deserve it because I would give the prize a story after the giveaway ends. I would show how ${contest.brand} fits into an ordinary day, with the kind of ${frame[2]} detail that makes people think, "Okay, that was made for her."`
  ];
}

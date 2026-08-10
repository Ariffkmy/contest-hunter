// What a contest actually asks you to *do*, as opposed to what it is about.
//
// The workspace was built for one format — write a comment — but that is a
// minority of the catalogue: most rows are buy&win, and the rest include video,
// design and cook&win entries where "here are three answers" is useless advice.
// Classifying the format lets one panel produce the right kind of help.
//
// Three formats, because they need genuinely different output:
//
//   text   — you write something. Drafts to copy.
//   media  — you shoot, cook, draw or film something. Concepts and a shot list.
//   action — you buy, share or transact. A checklist and the things people
//            get disqualified for.
//
// `closed` is the fourth state and produces nothing: winner announcements are
// scraped alongside live giveaways and cannot be entered at all.

export const FORMATS = {
  TEXT: "text",
  MEDIA: "media",
  ACTION: "action",
  CLOSED: "closed"
};

/** Scraped contest_type values, mapped to what the entrant has to produce. */
const TYPE_FORMATS = {
  comment: FORMATS.TEXT,
  "comment+share": FORMATS.TEXT,
  quiz: FORMATS.TEXT,
  caption: FORMATS.TEXT,

  video: FORMATS.MEDIA,
  reel: FORMATS.MEDIA,
  photo: FORMATS.MEDIA,
  design: FORMATS.MEDIA,
  "cook&win": FORMATS.MEDIA,
  ugc: FORMATS.MEDIA,

  "buy&win": FORMATS.ACTION,
  transaction: FORMATS.ACTION,
  share: FORMATS.ACTION,
  follow: FORMATS.ACTION,

  announcement: FORMATS.CLOSED
};

// Fallbacks for rows the scraper typed loosely or not at all. Media wins over
// action when both appear: "buy the product and post a video" is a media brief
// with a purchase step, and the creative part is where people need the help.
const MEDIA_HINTS =
  /\b(video|reel|tiktok|film|record|photo|picture|snap|selfie|image|foto|gambar|design|draw|sketch|cook|recipe|masak|bake|decorate|makeover|unbox)\w*/i;

const ACTION_HINTS =
  /\b(receipt|resit|purchase|buy|beli|spend|transaction|scan|register|sign\s?up|subscribe|store|outlet|voucher)\w*/i;

const TEXT_HINTS = /\b(comment|caption|answer|tell us|why you|complete the|slogan|tagline)\w*/i;

// "Snap your receipt and WhatsApp it" is a photo, but it is proof of purchase,
// not something to be creative about. A condition that mentions any of these is
// not a content brief no matter what verb it uses.
const PROOF_HINTS = /\b(receipt|resit|invoice|proof|ic\b|mykad|qr|barcode|serial)\w*/i;

/** True when a scraped condition asks for something genuinely made. */
function isCreativeCondition(condition) {
  return MEDIA_HINTS.test(condition) && !PROOF_HINTS.test(condition);
}

export const FORMAT_COPY = {
  [FORMATS.TEXT]: {
    label: "Written entry",
    blurb: "You win on what you write. Drafts below — edit one until it sounds like you.",
    promptLabel: "Answer prompt",
    inputLabel: "Personal angle",
    inputHint: "What makes your entry yours? Set a default in Settings.",
    action: "Generate answer ideas",
    outputEyebrow: "Answer drafts",
    outputTitle: "Three angles to choose from",
    emptyHint: "Hit Generate to draft three answers."
  },
  [FORMATS.MEDIA]: {
    label: "Content entry",
    blurb:
      "This one wants something made — a video, photo or design. Below are concepts you could actually shoot, not answers to paste.",
    promptLabel: "The brief",
    inputLabel: "What you can realistically make",
    inputHint: "Your kit, your setting, your skill level. Concepts get built around this.",
    action: "Generate content ideas",
    outputEyebrow: "Concept ideas",
    outputTitle: "Three things you could make",
    emptyHint: "Hit Generate for three concepts, each with a shot list."
  },
  [FORMATS.ACTION]: {
    label: "Action entry",
    blurb:
      "No writing needed — this is won by completing steps correctly. The risk is disqualification on a technicality.",
    promptLabel: "What the post asks for",
    inputLabel: "Anything specific to your situation",
    inputHint: "Which outlet, which product, how much you plan to spend.",
    action: "Generate an entry plan",
    outputEyebrow: "Entry plan",
    outputTitle: "Steps and the traps to avoid",
    emptyHint: "Hit Generate for a checklist and the common disqualifiers."
  },
  [FORMATS.CLOSED]: {
    label: "Not enterable",
    blurb:
      "This looks like a winner announcement rather than an open giveaway, so there is nothing to enter.",
    promptLabel: "Post content",
    inputLabel: "Notes",
    inputHint: "Kept for your own reference.",
    action: "Generate anyway",
    outputEyebrow: "Notes",
    outputTitle: "Nothing to enter",
    emptyHint: "Nothing to generate for a closed contest."
  }
};

/**
 * Best guess at the format. The scraped type is trusted first; the text hints
 * only run when the type is missing or unrecognised, so re-typing a row in the
 * catalogue always beats keyword matching.
 */
export function detectFormat(contest) {
  const mapped = TYPE_FORMATS[String(contest?.contestType ?? "").toLowerCase()];

  const haystack = [
    contest?.prompt,
    contest?.caption,
    ...(Array.isArray(contest?.conditions) ? contest.conditions : [])
  ]
    .filter(Boolean)
    .join(" ");

  const conditions = Array.isArray(contest?.conditions) ? contest.conditions : [];

  if (mapped) {
    // One exception to trusting the scraped type: plenty of buy&win contests
    // also want a video or a photo of the product. The purchase is the easy
    // half — the entrant needs help with the half they have to make.
    //
    // Only the scraped conditions are consulted here, never the caption:
    // captions are marketing prose that mention photographing receipts, and
    // upgrading on that turns a compliance checklist into a creative brief.
    if (mapped === FORMATS.ACTION && conditions.some(isCreativeCondition)) return FORMATS.MEDIA;
    return mapped;
  }

  if (MEDIA_HINTS.test(haystack)) return FORMATS.MEDIA;
  if (ACTION_HINTS.test(haystack)) return FORMATS.ACTION;
  if (TEXT_HINTS.test(haystack)) return FORMATS.TEXT;

  // An unreadable contest is still usually a comment giveaway.
  return FORMATS.TEXT;
}

export function formatCopy(contest) {
  return FORMAT_COPY[detectFormat(contest)] ?? FORMAT_COPY[FORMATS.TEXT];
}

/**
 * Answer Ideas (comment drafts) only make sense when the contest is actually
 * won by writing something in the comments. Media, action and closed contests
 * get no ideas panel — the UI hides the generator for them.
 */
export function requiresCommentAnswer(contest) {
  return detectFormat(contest) === FORMATS.TEXT;
}

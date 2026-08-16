import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  Bell,
  CalendarClock,
  Check,
  ChevronRight,
  Circle,
  Copy,
  ExternalLink,
  Heart,
  Instagram,
  Lock,
  MessageSquareQuote,
  Play,
  Share2,
  Sparkles,
  Trash2,
  Trophy,
  Wand2,
  X
} from "lucide-react";
import AppNav from "../components/AppNav.jsx";
import { useAuth } from "../auth/AuthProvider.jsx";
import { generateIdeas } from "../services/answers.js";
import {
  fetchDashboard,
  isFreeLimitError,
  saveAnswerDraft,
  setContestSaved,
  setContestStatus,
  untrackContest
} from "../services/contestsRepo.js";
import { applyHidden, readHidden, softDelete } from "../services/hiddenContests.js";
import { describeDeadline, formatTimestamp } from "../services/deadlines.js";
import { can, FEATURES, FREE_TRACKING_LIMIT } from "../services/entitlements.js";
import { formatCopy, requiresCommentAnswer } from "../services/contestFormats.js";

const statusTabs = [
  { id: "upcoming", label: "Upcoming", description: "Not started yet" },
  { id: "in_progress", label: "In progress", description: "Open for entries" },
  { id: "completed", label: "Completed", description: "Marked as done" }
];

const statusLabels = {
  upcoming: "Not started",
  in_progress: "In progress",
  completed: "Completed"
};

export default function Dashboard() {
  const { user, profile, isPro, plan } = useAuth();
  const [hidden, setHidden] = useState(readHidden);
  const [contests, setContests] = useState([]);
  const [meta, setMeta] = useState(null);
  const [loading, setLoading] = useState(true);
  const [dataError, setDataError] = useState(null);
  const [limitHit, setLimitHit] = useState(false);
  const [selectedId, setSelectedId] = useState(null);
  const [activeStatus, setActiveStatus] = useState("in_progress");
  const [personalNote, setPersonalNote] = useState("");
  const [ideas, setIdeas] = useState([]);
  const [generating, setGenerating] = useState(false);
  const [copied, setCopied] = useState("");

  // Desktop shows list + workspace side by side and auto-selects the first
  // contest; mobile shows the list first and opens the workspace as a sheet
  // only when the user taps a card.
  const [isMobile, setIsMobile] = useState(() => window.matchMedia("(max-width: 760px)").matches);

  useEffect(() => {
    const mq = window.matchMedia("(max-width: 760px)");
    const onChange = () => setIsMobile(mq.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  // Seed the workspace controls from the user's saved defaults once loaded.
  useEffect(() => {
    if (!profile) return;
    setPersonalNote(profile.personal_note ?? "");
  }, [profile]);

  const load = useCallback(async () => {
    const { contests: rows, meta: catalogMeta, error } = await fetchDashboard(user.id);
    setContests(applyHidden(rows, readHidden()));
    setMeta(catalogMeta);
    setDataError(error);
    setLoading(false);
  }, [user.id]);

  useEffect(() => {
    load();
  }, [load]);

  const visibleContests = useMemo(
    () => applyHidden(contests, hidden).filter((contest) => !contest.deleted),
    [contests, hidden]
  );

  const filteredContests = useMemo(
    () => visibleContests.filter((contest) => contest.status === activeStatus),
    [visibleContests, activeStatus]
  );

  const statusCounts = useMemo(
    () =>
      statusTabs.reduce((counts, tab) => {
        counts[tab.id] = visibleContests.filter((contest) => contest.status === tab.id).length;
        return counts;
      }, {}),
    [visibleContests]
  );

  const trackedCount = useMemo(
    () => visibleContests.filter((contest) => contest.tracked).length,
    [visibleContests]
  );
  const atLimit = !isPro && trackedCount >= FREE_TRACKING_LIMIT;

  const selected = selectedId
    ? filteredContests.find((contest) => contest.id === selectedId) ?? null
    : isMobile
      ? null
      : filteredContests[0] ?? null;

  // What this contest asks the entrant to produce drives the whole tool panel:
  // a video giveaway gets concepts, a buy&win gets a checklist.
  const copy = selected ? formatCopy(selected) : null;
  const needsCommentAnswer = selected ? requiresCommentAnswer(selected) : false;

  // Drafts belong to a single contest, so clear them when the workspace moves.
  useEffect(() => {
    setIdeas([]);
  }, [selected?.id]);

  const applyLocal = (contestId, patch) =>
    setContests((current) =>
      current.map((contest) => (contest.id === contestId ? { ...contest, ...patch } : contest))
    );

  const handleWriteError = (error, revert) => {
    revert();
    if (isFreeLimitError(error)) {
      setLimitHit(true);
      return;
    }
    setDataError(error);
  };

  const toggleSaved = async (id) => {
    const target = contests.find((contest) => contest.id === id);
    if (!target) return;
    const saved = !target.saved;
    const before = { saved: target.saved, tracked: target.tracked };

    applyLocal(id, { saved, tracked: true });
    const { error } = await setContestSaved(user.id, id, saved);
    if (error) {
      handleWriteError(error, () => applyLocal(id, before));
      return;
    }
    // A newly created tracking row changes the free-plan count.
    if (!before.tracked) load();
  };

  // Takes an explicit id rather than reading `selected`: the card's start
  // button needs to move a contest that isn't the selected one, and setSelectedId
  // wouldn't have taken effect yet in the same tick.
  const moveContestToStatus = async (id, status) => {
    const target = contests.find((contest) => contest.id === id);
    if (!target) return;
    const before = { status: target.status, tracked: target.tracked };

    applyLocal(id, { status, tracked: true });
    setActiveStatus(status);
    setSelectedId(id);

    const { error } = await setContestStatus(user.id, id, status);
    if (error) {
      handleWriteError(error, () => {
        applyLocal(id, before);
        setActiveStatus(before.status);
      });
      return;
    }
    if (!before.tracked) load();
  };

  const moveSelectedToStatus = (status) =>
    selected ? moveContestToStatus(selected.id, status) : undefined;

  const stopTracking = async (id) => {
    const target = contests.find((contest) => contest.id === id);
    if (!target) return;
    const { error } = await untrackContest(user.id, id);
    if (error) {
      setDataError(error);
      return;
    }
    setLimitHit(false);
    load();
  };

  const hideContest = (contest) => {
    const ok = window.confirm(
      `Delete "${contest.brand}"? It moves to Deleted contests, and you can restore it any time.`
    );
    if (!ok) return;
    setHidden(softDelete(hidden, contest.id));
    if (selectedId === contest.id) setSelectedId(null);
  };

  const refreshIdeas = async () => {
    if (!selected) return;
    setGenerating(true);
    const { ideas: nextIdeas, model, error } = await generateIdeas({
      contest: selected,
      personalNote,
      isPro
    });
    setIdeas(nextIdeas);
    setGenerating(false);
    if (error) setDataError(error);

    // Keep a copy of what was generated so drafts survive a reload.
    for (const answer of nextIdeas) {
      saveAnswerDraft({
        userId: user.id,
        contestId: selected.id,
        personalAngle: personalNote,
        answer,
        model
      });
    }
  };

  const copyIdea = async (text) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(text);
      window.setTimeout(() => setCopied(""), 1200);
    } catch {
      setCopied("");
    }
  };

  const shareContest = async () => {
    const shareText = `${selected.brand}: ${selected.prize}\n${selected.instagramUrl}`;
    if (navigator.share) {
      await navigator.share({ title: selected.brand, text: shareText, url: selected.instagramUrl });
      return;
    }
    await navigator.clipboard.writeText(shareText);
    setCopied("contest-link");
    window.setTimeout(() => setCopied(""), 1200);
  };

  if (loading) {
    return (
      <>
        <AppNav />
        <main className="app-shell">
          <section className="workspace empty-workspace">
            <div className="empty-workspace-panel">
              <Trophy size={32} />
              <h2>Loading contests…</h2>
            </div>
          </section>
        </main>
      </>
    );
  }

  return (
    <>
      <AppNav />
      <main className="app-shell">
        <section className="contest-list" aria-label="Scraped Instagram contests">
          <div className="section-header">
            <div>
              <p className="eyebrow">
                {meta?.total ?? contests.length} scraped giveaways · synced{" "}
                {formatTimestamp(meta?.scrapedAt)}
              </p>
              <h2>Your board</h2>
            </div>
            {!isPro && (
              <span className="tracking-counter" title="Contests you are tracking">
                {trackedCount}/{FREE_TRACKING_LIMIT}
              </span>
            )}
          </div>

          {dataError && <p className="data-notice">{dataError}</p>}

          {(limitHit || atLimit) && !isPro && (
            <div className="upgrade-notice">
              <Lock size={16} />
              <div>
                <strong>Free plan limit reached</strong>
                <p>
                  You're tracking {trackedCount} of {FREE_TRACKING_LIMIT} contests. Stop tracking
                  one, or <Link to="/pricing">go Pro</Link> for unlimited tracking and AI drafts.
                </p>
              </div>
            </div>
          )}

          <div className="status-tabs" role="tablist" aria-label="Contest status">
            {statusTabs.map((tab) => (
              <button
                key={tab.id}
                className={activeStatus === tab.id ? "status-tab active" : "status-tab"}
                onClick={() => setActiveStatus(tab.id)}
                role="tab"
                aria-selected={activeStatus === tab.id}
              >
                <span>{tab.label}</span>
                <strong>{statusCounts[tab.id] ?? 0}</strong>
              </button>
            ))}
          </div>

          <div className="cards">
            {filteredContests.length > 0 ? (
              filteredContests.map((contest) => (
                <ContestCard
                  key={contest.id}
                  contest={contest}
                  active={contest.id === selected?.id}
                  onSelect={() => setSelectedId(contest.id)}
                  onSave={() => toggleSaved(contest.id)}
                  onDelete={() => hideContest(contest)}
                  onStart={
                    contest.status === "upcoming"
                      ? () => moveContestToStatus(contest.id, "in_progress")
                      : null
                  }
                />
              ))
            ) : (
              <div className="empty-state">
                <Circle size={22} />
                <p>No contests here yet.</p>
              </div>
            )}
          </div>
        </section>

        {selected ? (
          <section className="workspace" aria-label="Contest workspace">
            <button
              className="workspace-close"
              onClick={() => setSelectedId(null)}
              aria-label="Close contest"
            >
              <X size={20} />
            </button>
            <div className="detail-band">
              <div
                className="contest-art"
                style={{
                  backgroundImage: selected.imageUrl ? `url(${selected.imageUrl})` : selected.art,
                  backgroundSize: "cover",
                  backgroundPosition: "center"
                }}
              >
                <span>{selected.source}</span>
              </div>
              <div className="detail-main">
                <div className="detail-title-row">
                  <div>
                    <p className="eyebrow">{selected.brand}</p>
                    <h2>{selected.prize}</h2>
                  </div>
                  <button className="primary-icon" onClick={shareContest} title="Share contest">
                    <Share2 size={18} />
                  </button>
                </div>
                <p className="caption">{selected.caption}</p>
                <div className="quick-facts">
                  <span>
                    <CalendarClock size={15} />
                    Starts {selected.startsAt}
                  </span>
                  <span>
                    <CalendarClock size={15} />
                    Ends {selected.deadline}
                  </span>
                  <span>
                    <Instagram size={15} />
                    {selected.handle}
                  </span>
                  <span>
                    <Bell size={15} />
                    {selected.effort}
                  </span>
                  <span>
                    <Sparkles size={15} />
                    {selected.engagement.likes} likes · {selected.engagement.comments} comments
                  </span>
                </div>
                <div className="description-actions">
                  <a
                    className="open-link"
                    href={selected.instagramUrl}
                    target="_blank"
                    rel="noreferrer"
                  >
                    <ExternalLink size={16} />
                    Open Instagram post
                  </a>
                  {selected.tracked && (
                    <button className="quiet-link" onClick={() => stopTracking(selected.id)}>
                      Stop tracking
                    </button>
                  )}
                </div>
              </div>
            </div>

            {needsCommentAnswer ? (
              <div className="workspace-grid">
                <section className="tool-panel">
                  <div className="panel-heading">
                    <div>
                      <p className="eyebrow">{copy.promptLabel}</p>
                      <h3>{selected.prompt}</h3>
                    </div>
                    <MessageSquareQuote size={20} />
                  </div>

                  <p className="format-note">
                    <span className="format-chip">{copy.label}</span>
                    {copy.blurb}
                  </p>

                  <label className="field-label" htmlFor="note">
                    {copy.inputLabel}
                  </label>
                  <textarea
                    id="note"
                    value={personalNote}
                    onChange={(event) => setPersonalNote(event.target.value)}
                    rows={4}
                    placeholder={copy.inputHint}
                  />


                  <button className="generate-button" onClick={refreshIdeas} disabled={generating}>
                    <Wand2 size={17} />
                    {generating ? "Thinking…" : copy.action}
                  </button>
                </section>

                <section className="tool-panel">
                  <div className="panel-heading">
                    <div>
                      <p className="eyebrow">
                        {isPro ? "AI" : "Template"} · {copy.outputEyebrow}
                      </p>
                      <h3>{copy.outputTitle}</h3>
                    </div>
                    <Sparkles size={20} />
                  </div>

                  {!isPro && (
                    <p className="field-hint upsell">
                      <Lock size={13} /> Real AI ideas are a Pro feature.{" "}
                      <Link to="/pricing">Upgrade</Link>
                    </p>
                  )}

                  <div className="ideas">
                    {ideas.length === 0 && <p className="field-hint">{copy.emptyHint}</p>}
                    {ideas.map((idea) => (
                      <article className="idea" key={idea}>
                        <p>{idea}</p>
                        <button className="copy-button" onClick={() => copyIdea(idea)}>
                          {copied === idea ? <Check size={16} /> : <Copy size={16} />}
                          {copied === idea ? "Copied" : "Copy"}
                        </button>
                      </article>
                    ))}
                  </div>
                </section>
              </div>
            ) : (
              <div className="no-ideas-note">
                <p className="eyebrow">No answer ideas</p>
                <h3>This contest isn't won by commenting</h3>
                <p className="field-hint">{copy.blurb}</p>
              </div>
            )}

            <section className="conditions-band">
              <div>
                <p className="eyebrow">Entry requirements</p>
                <h3>What the scraper found</h3>
              </div>
              <ul>
                {selected.conditions.map((condition) => (
                  <li key={condition}>{condition}</li>
                ))}
              </ul>
            </section>

            <section className="status-action-band">
              <div>
                <p className="eyebrow">Contest status</p>
                <h3>{statusLabels[selected.status]}</h3>
              </div>
              <div className="status-actions">
                {selected.status !== "completed" ? (
                  <button
                    className="complete-button"
                    onClick={() => moveSelectedToStatus("completed")}
                  >
                    <Check size={16} />
                    Mark completed
                  </button>
                ) : (
                  <button
                    className="complete-button"
                    onClick={() => moveSelectedToStatus("in_progress")}
                  >
                    <ChevronRight size={16} />
                    Move to progress
                  </button>
                )}
                {selected.status === "upcoming" && (
                  <button
                    className="secondary-button"
                    onClick={() => moveSelectedToStatus("in_progress")}
                  >
                    Start now
                  </button>
                )}
              </div>
            </section>
          </section>
        ) : isMobile ? null : (
          <section className="workspace empty-workspace" aria-label="Contest workspace">
            <div className="empty-workspace-panel">
              <Trophy size={32} />
              <h2>No {statusTabs.find((tab) => tab.id === activeStatus)?.label.toLowerCase()} contests</h2>
              <p>When a contest moves into this stage, it will show up here.</p>
            </div>
          </section>
        )}
      </main>
    </>
  );
}

function ContestCard({ contest, active, onSelect, onSave, onDelete, onStart }) {
  const deadline = describeDeadline(contest.deadline);
  return (
    <article className={active ? "contest-card active" : "contest-card"} onClick={onSelect}>
      <div
        className="thumb"
        style={{
          backgroundImage: contest.imageUrl ? `url(${contest.imageUrl})` : contest.art,
          backgroundSize: "cover",
          backgroundPosition: "center"
        }}
      >
        <button
          className={contest.saved ? "save-button saved" : "save-button"}
          onClick={(event) => {
            event.stopPropagation();
            onSave();
          }}
          title={contest.saved ? "Saved" : "Save contest"}
        >
          <Heart size={15} fill={contest.saved ? "currentColor" : "none"} />
        </button>
        <button
          className="save-button delete-button"
          onClick={(event) => {
            event.stopPropagation();
            onDelete();
          }}
          title="Delete contest"
        >
          <Trash2 size={15} />
        </button>
      </div>
      <div className="card-content">
        <div className="card-title">
          <h3>{contest.brand}</h3>
          <ChevronRight size={16} />
        </div>
        <p>{contest.prize}</p>
        <div className="status-chip">
          <Circle size={10} fill="currentColor" />
          {statusLabels[contest.status]}
          {contest.tracked && <span className="tracked-dot" title="Tracking" />}
        </div>
        <p className={`deadline-line ${deadline.urgency}`}>{deadline.label}</p>
        <p className="engagement-line">
          {contest.engagement.likes} likes · {contest.engagement.comments} comments
        </p>
        {onStart && (
          <button
            className="start-button"
            onClick={(event) => {
              event.stopPropagation();
              onStart();
            }}
          >
            <Play size={13} />
            Move to In progress
          </button>
        )}
      </div>
    </article>
  );
}

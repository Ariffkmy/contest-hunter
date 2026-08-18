import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  Bell,
  CalendarClock,
  Check,
  CheckSquare2,
  ChevronDown,
  ChevronRight,
  Circle,
  Copy,
  ExternalLink,
  Heart,
  Instagram,
  ListFilter,
  Lock,
  MessageSquareQuote,
  Play,
  Share2,
  Sparkles,
  Square,
  Trash2,
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

const contestTabs = [
  { id: "new_today", label: "Newly Added Today", description: "Added in the last 24 hours" },
  { id: "all", label: "All Contests", description: "The full contest repository" },
  { id: "selected", label: "Your Selected", description: "Contests you have selected to track" }
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
    const [activeTab, setActiveTab] = useState("new_today");
  const [selectedTypes, setSelectedTypes] = useState([]);
  const [typeFilterOpen, setTypeFilterOpen] = useState(false);
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

  const filteredContests = useMemo(() => {
      const now = Date.now();
      const dayAgo = now - 24 * 60 * 60 * 1000;
      switch (activeTab) {
        case "new_today":
          return visibleContests.filter((c) => {
            const t = c.scraped_at ? new Date(c.scraped_at).getTime() : 0;
            return t >= dayAgo;
          });
        case "selected":
          return visibleContests.filter((c) => c.tracked);
        default:
          return visibleContests;
      }
    }, [visibleContests, activeTab]);

  /**
   * Type filter, mirroring the mobile app: multi-select, empty = everything,
   * options derived from the contests actually in this tab so the filter never
   * offers a choice that yields nothing. Selections that the next tab doesn't
   * contain are dropped rather than silently filtering everything away.
   */
  const typeOptions = useMemo(() => {
    const counts = filteredContests.reduce((acc, c) => {
      const key = c.contestType || "other";
      acc[key] = (acc[key] ?? 0) + 1;
      return acc;
    }, {});
    return Object.entries(counts)
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
      .map(([type, count]) => ({ type, count }));
  }, [filteredContests]);

  const effectiveTypes = useMemo(
    () => selectedTypes.filter((t) => typeOptions.some((o) => o.type === t)),
    [selectedTypes, typeOptions]
  );

  const shownContests = useMemo(
    () =>
      effectiveTypes.length === 0
        ? filteredContests
        : filteredContests.filter((c) => effectiveTypes.includes(c.contestType || "other")),
    [filteredContests, effectiveTypes]
  );

  const statusCounts = useMemo(
      () => {
        const now = Date.now();
        const dayAgo = now - 24 * 60 * 60 * 1000;
        return {
          new_today: visibleContests.filter((c) => {
            const t = c.scraped_at ? new Date(c.scraped_at).getTime() : 0;
            return t >= dayAgo;
          }).length,
          all: visibleContests.length,
          selected: visibleContests.filter((c) => c.tracked).length,
        };
      },
      [visibleContests]
    );

  const trackedCount = useMemo(
    () => visibleContests.filter((contest) => contest.tracked).length,
    [visibleContests]
  );
  const atLimit = !isPro && trackedCount >= FREE_TRACKING_LIMIT;

  const selected = selectedId
    ? shownContests.find((contest) => contest.id === selectedId) ?? null
    : isMobile
      ? null
      : shownContests[0] ?? null;

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
    setActiveTab(status);
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
              <img src="/logo.png" alt="Contest Hunter" className="logo-img-lg" />
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

          <div className="status-tabs" role="tablist" aria-label="Contest tabs">
                      {contestTabs.map((tab) => (
                        <button
                          key={tab.id}
                          className={activeTab === tab.id ? "status-tab active" : "status-tab"}
                          onClick={() => setActiveTab(tab.id)}
                          role="tab"
                          aria-selected={activeTab === tab.id}
                        >
                          <span>{tab.label}</span>
                          <strong>{statusCounts[tab.id] ?? 0}</strong>
                        </button>
                      ))}
          </div>

          {typeOptions.length > 1 && (
            <TypeFilter
              options={typeOptions}
              selected={effectiveTypes}
              onChange={setSelectedTypes}
              open={typeFilterOpen}
              setOpen={setTypeFilterOpen}
            />
          )}

          <div className="cards">
            {shownContests.length > 0 ? (
              shownContests.map((contest) => (
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
                <p>
                  {effectiveTypes.length === 0
                    ? "No contests here yet."
                    : "Nothing matches those types."}
                </p>
                {effectiveTypes.length > 0 && (
                  <button className="quiet-link" onClick={() => setSelectedTypes([])}>
                    Clear filter
                  </button>
                )}
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
                          <div className="contest-art">
                            {selected.imageUrl ? (
                              <img src={selected.imageUrl} alt={selected.brand} className="contest-image" />
                            ) : (
                              <div className="thumb-gradient" style={{ background: selected.art }} />
                            )}
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
              <img src="/logo.png" alt="Contest Hunter" className="logo-img-lg" />
              <h2>No {activeTab === "new_today" ? "new" : activeTab === "selected" ? "selected" : ""} contests</h2>
                            <p>{activeTab === "new_today" ? "No new contests have been added in the last 24 hours." : activeTab === "selected" ? "Select contests from the All Contests tab to track them here." : "No contests available right now."}</p>
            </div>
          </section>
        )}
      </main>
    </>
  );
}

function TypeFilter({ options, selected, onChange, open, setOpen }) {
  const formatType = (type) => type.replaceAll("&", " & ");

  const label =
    selected.length === 0
      ? "All types"
      : selected.length === 1
        ? formatType(selected[0])
        : `${selected.length} types`;

  const toggle = (type) =>
    onChange(selected.includes(type) ? selected.filter((t) => t !== type) : [...selected, type]);

  return (
    <div className="type-filter">
      <button
        className={selected.length > 0 ? "type-filter-btn active" : "type-filter-btn"}
        onClick={() => setOpen(!open)}
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        <ListFilter size={14} />
        <span>{label}</span>
        <ChevronDown size={15} />
      </button>
      {selected.length > 0 && (
        <button className="type-filter-clear" onClick={() => onChange([])}>
          Clear
        </button>
      )}

      {open && (
        <>
          <div className="type-filter-backdrop" onClick={() => setOpen(false)} />
          <div className="type-filter-menu" role="listbox" aria-label="Filter by type">
            <div className="type-filter-head">
              <span>Filter by type</span>
              {selected.length > 0 && (
                <button onClick={() => onChange([])}>Reset</button>
              )}
            </div>
            {options.map(({ type, count }) => {
              const isSelected = selected.includes(type);
              return (
                <button
                  key={type}
                  className={isSelected ? "type-filter-option selected" : "type-filter-option"}
                  onClick={() => toggle(type)}
                  role="option"
                  aria-selected={isSelected}
                >
                  {isSelected ? <CheckSquare2 size={17} /> : <Square size={17} />}
                  <span>{formatType(type)}</span>
                  <em>{count}</em>
                </button>
              );
            })}
            <button className="type-filter-done" onClick={() => setOpen(false)}>
              Done
            </button>
          </div>
        </>
      )}
    </div>
  );
}

function ContestCard({ contest, active, onSelect, onSave, onDelete, onStart }) {
  const deadline = describeDeadline(contest.deadline);
  return (
    <article className={active ? "contest-card active" : "contest-card"} onClick={onSelect}>
      <div className="thumb">
              {contest.imageUrl ? (
                <img src={contest.imageUrl} alt={contest.brand} className="thumb-image" />
              ) : (
                <div className="thumb-gradient" style={{ background: contest.art }} />
              )}
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

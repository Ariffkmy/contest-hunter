import React, { useEffect, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
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
  MessageSquareQuote,
  Plus,
  Share2,
  Sparkles,
  Trophy,
  Wand2
} from "lucide-react";
import { generateAnswerIdeas } from "./services/answerRecommender.js";
import { contests as seedContests, scrapeMeta } from "./sampleData.js";
import "./styles.css";

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

function App() {
  const [contests, setContests] = useState(seedContests);
  const [selectedId, setSelectedId] = useState(seedContests[0].id);
  const [activeStatus, setActiveStatus] = useState("in_progress");
  const [tone, setTone] = useState("Warm");
  const [personalNote, setPersonalNote] = useState(
    "I love practical items that turn daily routines into small rituals."
  );
  const [ideas, setIdeas] = useState(generateAnswerIdeas(seedContests[0], tone, personalNote));
  const [copied, setCopied] = useState("");

  const selected = contests.find((contest) => contest.id === selectedId) ?? contests[0];
  const filteredContests = useMemo(() => {
    return contests.filter((contest) => contest.status === activeStatus);
  }, [contests, activeStatus]);

  const statusCounts = useMemo(
    () =>
      statusTabs.reduce((counts, tab) => {
        counts[tab.id] = contests.filter((contest) => contest.status === tab.id).length;
        return counts;
      }, {}),
    [contests]
  );

  useEffect(() => {
    const selectedStillVisible = filteredContests.some((contest) => contest.id === selectedId);
    if (selectedStillVisible || filteredContests.length === 0) return;
    setSelectedId(filteredContests[0].id);
    setIdeas(generateAnswerIdeas(filteredContests[0], tone, personalNote));
  }, [activeStatus, filteredContests, personalNote, selectedId, tone]);

  const updateSelected = (contest) => {
    setSelectedId(contest.id);
    setIdeas(generateAnswerIdeas(contest, tone, personalNote));
  };

  const toggleSaved = (id) => {
    setContests((current) =>
      current.map((contest) =>
        contest.id === id ? { ...contest, saved: !contest.saved } : contest
      )
    );
  };

  const moveSelectedToStatus = (status) => {
    setContests((current) =>
      current.map((contest) => (contest.id === selected.id ? { ...contest, status } : contest))
    );
    setActiveStatus(status);
  };

  const refreshIdeas = () => {
    setIdeas(generateAnswerIdeas(selected, tone, personalNote));
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

  return (
    <main className="app-shell">
      <section className="contest-list" aria-label="Scraped Instagram contests">
        <div className="brand-row">
          <div className="logo-mark">
            <Trophy size={20} />
          </div>
          <div>
            <h1>Contest Hunter</h1>
            <p>{scrapeMeta.total} scraped Instagram giveaways</p>
          </div>
        </div>

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

        <div className="section-header">
          <div>
            <p className="eyebrow">{statusTabs.find((tab) => tab.id === activeStatus)?.description}</p>
            <h2>{statusTabs.find((tab) => tab.id === activeStatus)?.label}</h2>
          </div>
          <button className="icon-button" title="Add contest">
            <Plus size={18} />
          </button>
        </div>

        <div className="cards">
          {filteredContests.length > 0 ? (
            filteredContests.map((contest) => (
              <ContestCard
                key={contest.id}
                contest={contest}
                active={contest.id === selected.id}
                onSelect={() => updateSelected(contest)}
                onSave={() => toggleSaved(contest.id)}
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

      {filteredContests.length > 0 ? (
      <section className="workspace" aria-label="Contest workspace">
        <div className="detail-band">
          <div className="contest-art" style={{ backgroundImage: selected.art }}>
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
              <a className="open-link" href={selected.instagramUrl} target="_blank" rel="noreferrer">
                <ExternalLink size={16} />
                Open Instagram post
              </a>
            </div>
          </div>
        </div>

        <div className="workspace-grid">
          <section className="tool-panel">
            <div className="panel-heading">
              <div>
                <p className="eyebrow">Answer prompt</p>
                <h3>{selected.prompt}</h3>
              </div>
              <MessageSquareQuote size={20} />
            </div>

            <label className="field-label" htmlFor="note">
              Personal angle
            </label>
            <textarea
              id="note"
              value={personalNote}
              onChange={(event) => setPersonalNote(event.target.value)}
              rows={4}
            />

            <div className="tone-row" role="group" aria-label="Tone">
              {["Warm", "Funny", "Premium", "Bold"].map((toneName) => (
                <button
                  key={toneName}
                  className={tone === toneName ? "tone active" : "tone"}
                  onClick={() => setTone(toneName)}
                >
                  {toneName}
                </button>
              ))}
            </div>

            <button className="generate-button" onClick={refreshIdeas}>
              <Wand2 size={17} />
              Generate answer ideas
            </button>
          </section>

          <section className="tool-panel">
            <div className="panel-heading">
              <div>
                <p className="eyebrow">AI recommendations</p>
                <h3>Unique drafts</h3>
              </div>
              <Sparkles size={20} />
            </div>
            <div className="ideas">
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
              <button className="complete-button" onClick={() => moveSelectedToStatus("completed")}>
                <Check size={16} />
                Mark completed
              </button>
            ) : (
              <button className="complete-button" onClick={() => moveSelectedToStatus("in_progress")}>
                <ChevronRight size={16} />
                Move to progress
              </button>
            )}
            {selected.status === "upcoming" && (
              <button className="secondary-button" onClick={() => moveSelectedToStatus("in_progress")}>
                Start now
              </button>
            )}
          </div>
        </section>
      </section>
      ) : (
        <section className="workspace empty-workspace" aria-label="Contest workspace">
          <div className="empty-workspace-panel">
            <Trophy size={32} />
            <h2>No {statusTabs.find((tab) => tab.id === activeStatus)?.label.toLowerCase()} contests</h2>
            <p>When a contest moves into this stage, it will show up here with its answer workspace.</p>
          </div>
        </section>
      )}
    </main>
  );
}

function ContestCard({ contest, active, onSelect, onSave }) {
  return (
    <article className={active ? "contest-card active" : "contest-card"} onClick={onSelect}>
      <div className="thumb" style={{ backgroundImage: contest.art }}>
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
        </div>
        <p className="engagement-line">
          {contest.engagement.likes} likes · {contest.engagement.comments} comments
        </p>
      </div>
    </article>
  );
}

createRoot(document.getElementById("root")).render(<App />);

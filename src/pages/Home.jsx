import React, { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { AlarmClock, BarChart3, Lock, Target, Trash2 } from "lucide-react";
import AppNav from "../components/AppNav.jsx";
import { useAuth } from "../auth/AuthProvider.jsx";
import { fetchDashboard } from "../services/contestsRepo.js";
import { applyHidden, readHidden } from "../services/hiddenContests.js";
import { buildStats, greeting } from "../services/analytics.js";
import { formatDate } from "../services/deadlines.js";
import { can, FEATURE_COPY, FEATURES } from "../services/entitlements.js";

/**
 * Matches the mobile Home tab: an action layer (closing soon, best odds) over
 * an insight layer (completion, breakdown, averages). The insight layer and the
 * odds ranking are Pro; the counts and the deadline list are free, because a
 * paywall in front of "what closes today" would make the free app useless.
 */
export default function Home() {
  const { user, plan } = useAuth();
  const [contests, setContests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const hasAnalytics = can(plan, FEATURES.ODDS_ANALYTICS);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { contests: rows, error: loadError } = await fetchDashboard(user.id);
      if (cancelled) return;
      setContests(applyHidden(rows, readHidden()));
      setError(loadError);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [user.id]);

  const stats = useMemo(() => buildStats(contests), [contests]);

  if (loading) {
    return (
      <>
        <AppNav />
        <main className="settings-shell">
          <div className="empty-workspace-panel">
            <img src="/logo.png" alt="Contest Hunter" className="logo-img-lg" />
            <h2>Loading your board…</h2>
          </div>
        </main>
      </>
    );
  }

  return (
    <>
      <AppNav />
      <main className="settings-shell home-shell">
        <div className="settings-heading">
          <p className="eyebrow">
            {formatDate(new Date())}
            {stats.closingThisWeek > 0
              ? ` · ${stats.closingThisWeek} closing this week`
              : " · nothing closing this week"}
          </p>
          <h1>{greeting()}</h1>
        </div>

        {error && <p className="data-notice">{error}</p>}

        <div className="stat-row">
          <StatTile value={stats.counts.in_progress} label="In progress" />
          <StatTile value={stats.counts.completed} label="Completed" />
          <StatTile value={stats.counts.saved} label="Saved" />
          <StatTile value={stats.counts.tracked} label="Tracked" />
        </div>

        <section className="home-panel">
          <div className="home-panel-head">
            <h2>
              <AlarmClock size={16} /> Closing soon
            </h2>
            <Link className="quiet-link" to="/app">
              See all
            </Link>
          </div>

          {stats.closingSoon.length === 0 ? (
            <p className="field-hint">Nothing with a confirmed date is closing yet.</p>
          ) : (
            <ul className="home-list">
              {stats.closingSoon.map(({ contest, deadline }) => (
                <li key={contest.id}>
                  <span className="home-list-main">
                    <strong>{contest.brand}</strong>
                    <span>{contest.prize}</span>
                  </span>
                  <span
                    className={
                      deadline.urgency === "critical" ? "home-meta critical" : "home-meta"
                    }
                  >
                    {deadline.days === 0
                      ? "today"
                      : deadline.days === 1
                        ? "tomorrow"
                        : `${deadline.days}d`}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="home-panel">
          <div className="home-panel-head">
            <h2>
              <Target size={16} /> Best odds
            </h2>
          </div>

          {!hasAnalytics ? (
            <ProUpsell feature={FEATURES.ODDS_ANALYTICS} />
          ) : stats.bestOdds.length === 0 ? (
            <p className="field-hint">No open contests with entry data.</p>
          ) : (
            <>
              <ul className="home-list">
                {stats.bestOdds.map((contest) => (
                  <li key={contest.id}>
                    <span className="home-list-main">
                      <strong>{contest.brand}</strong>
                      <span>{contest.effort}</span>
                    </span>
                    <span className="home-meta">{contest.engagement.comments} entries</span>
                  </li>
                ))}
              </ul>
              <p className="field-hint">
                Ranked by comment count on the post, which stands in for entries. Treat it as a
                hint, not a headcount.
              </p>
            </>
          )}
        </section>

        <section className="home-panel">
          <div className="home-panel-head">
            <h2>
              <BarChart3 size={16} /> Completion
            </h2>
          </div>
          <div className="progress-head">
            <strong>{stats.completionRate}%</strong>
            <span>
              {stats.counts.completed} of {stats.completionBase} entered
            </span>
          </div>
          <div className="progress-track">
            <div className="progress-fill" style={{ width: `${stats.completionRate}%` }} />
          </div>
        </section>

        {hasAnalytics ? (
          <>
            <section className="home-panel">
              <div className="home-panel-head">
                <h2>By contest type</h2>
              </div>
              <div className="bar-list">
                {stats.byType.map(({ type, count }) => (
                  <div className="bar-row" key={type}>
                    <span className="bar-label">{type}</span>
                    <span className="bar-track">
                      <span
                        className="bar-fill"
                        style={{ width: `${stats.typeMax ? (count / stats.typeMax) * 100 : 0}%` }}
                      />
                    </span>
                    <span className="bar-count">{count}</span>
                  </div>
                ))}
              </div>
            </section>

            <div className="stat-row">
              <StatTile value={stats.avgEntries} label="Avg entries" />
              <StatTile value={stats.avgSteps} label="Avg steps" />
              <StatTile value={stats.undatedCount} label="No deadline" />
            </div>
          </>
        ) : (
          <section className="home-panel">
            <div className="home-panel-head">
              <h2>Insights</h2>
            </div>
            <ProUpsell feature={FEATURES.ODDS_ANALYTICS} />
          </section>
        )}

        {stats.counts.deleted > 0 && (
          <Link className="deleted-hint" to="/deleted">
            <Trash2 size={15} />
            {stats.counts.deleted} deleted contest{stats.counts.deleted === 1 ? "" : "s"} · review
          </Link>
        )}
      </main>
    </>
  );
}

function StatTile({ value, label }) {
  return (
    <div className="stat-tile">
      <strong>{value}</strong>
      <span>{label}</span>
    </div>
  );
}

function ProUpsell({ feature }) {
  const copy = FEATURE_COPY[feature];
  return (
    <div className="pro-upsell">
      <span className="pro-upsell-badge">
        <Lock size={12} /> Pro
      </span>
      <strong>{copy.title}</strong>
      <p>{copy.blurb}</p>
      <Link to="/pricing">Upgrade</Link>
    </div>
  );
}

import React, { useEffect, useMemo, useState } from "react";
import {
  BadgeCheck,
  Clock,
  ExternalLink,
  Heart,
  Monitor,
  RefreshCw,
  ShieldAlert,
  Sparkles,
  UserCog
} from "lucide-react";
import AppNav from "../components/AppNav.jsx";
import {
  describeDevice,
  fetchAdminUserDetail,
  fetchAdminUsers,
  grantPro
} from "../services/admin.js";
import { formatTimestamp, relativeFromNow } from "../services/deadlines.js";

const statusLabels = {
  upcoming: "Not started",
  in_progress: "In progress",
  completed: "Completed"
};

function formatDateTime(iso) {
  if (!iso) return "Never";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return String(iso);
  return date.toLocaleString(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  });
}

/**
 * The three per-account panels: what they set, what they joined, what the
 * generator wrote for them. Loaded lazily by the parent on first expand.
 */
function AccountDetail({ detail }) {
  if (!detail) return null;
  if (detail.loading) return <p className="field-hint">Loading account data…</p>;
  if (detail.error) return <p className="data-notice">{detail.error}</p>;

  const { settings, contests = [], drafts = [] } = detail;

  return (
    <>
      <p className="eyebrow">Settings</p>
      <ul className="data-rows">
        <li>
          <span>Name</span>
          <strong>{settings?.fullName || "—"}</strong>
        </li>
        <li>
          <span>Default tone</span>
          <strong>{settings?.defaultTone ?? "—"}</strong>
        </li>
        <li>
          <span>Profile updated</span>
          <strong>{formatTimestamp(settings?.profileUpdatedAt)}</strong>
        </li>
      </ul>
      <p className="field-label">Personal angle</p>
      <p className="admin-quote">{settings?.personalNote?.trim() || "Not set"}</p>

      <p className="eyebrow">Contests joined ({contests.length})</p>
      {contests.length === 0 ? (
        <p className="field-hint">This account hasn't tracked a contest yet.</p>
      ) : (
        <ul className="admin-contests">
          {contests.map((contest) => (
            <li key={contest.contestId}>
              <div className="admin-contest-main">
                <strong>{contest.brand}</strong>
                <span>{contest.prize}</span>
              </div>
              <div className="admin-contest-meta">
                <span className="status-chip">{statusLabels[contest.status] ?? contest.status}</span>
                {contest.saved && (
                  <span className="plan-badge">
                    <Heart size={11} /> Saved
                  </span>
                )}
                <em>joined {formatTimestamp(contest.joinedAt)}</em>
                {contest.postUrl && (
                  <a href={contest.postUrl} target="_blank" rel="noreferrer" title="Open post">
                    <ExternalLink size={13} />
                  </a>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}

      <p className="eyebrow">Answer drafts ({drafts.length})</p>
      {drafts.length === 0 ? (
        <p className="field-hint">No drafts generated.</p>
      ) : (
        <ul className="admin-drafts">
          {drafts.map((draft) => (
            <li key={draft.id}>
              <div className="admin-draft-head">
                <strong>{draft.brand}</strong>
                <span className="plan-badge">{draft.tone}</span>
                <em>
                  {draft.model ? `${draft.model} · ` : "template · "}
                  {formatTimestamp(draft.createdAt)}
                </em>
              </div>
              <p className="admin-quote">{draft.answer}</p>
              {draft.personalAngle && (
                <p className="field-hint">Angle used: {draft.personalAngle}</p>
              )}
            </li>
          ))}
        </ul>
      )}
      <p className="field-hint">
        Every generated draft is stored, in order. Nothing records which one the user actually
        posted — the app copies to the clipboard and the choice never reaches us.
      </p>
    </>
  );
}

export default function Admin() {
  const [users, setUsers] = useState([]);
  const [generatedAt, setGeneratedAt] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(null);

  // Detail is fetched per account on first expand and then kept, so collapsing
  // and reopening a card doesn't re-hit the function.
  const [details, setDetails] = useState({});

  // Which account has a grant in flight, and the per-account result of the last
  // attempt. Keyed by id so one failure doesn't clear another card's message.
  const [granting, setGranting] = useState(null);
  const [grantNotice, setGrantNotice] = useState({});

  const grant = async (userId) => {
    setGranting(userId);
    setGrantNotice((current) => ({ ...current, [userId]: null }));

    const { subscription, error: grantError } = await grantPro(userId);

    if (grantError) {
      setGrantNotice((current) => ({ ...current, [userId]: { ok: false, message: grantError } }));
    } else {
      // Patch in place rather than reloading: the list is one function call per
      // refresh and the response already tells us the new state of the row.
      setUsers((current) =>
        current.map((row) =>
          row.id === userId
            ? {
                ...row,
                plan: subscription?.plan ?? "pro",
                planStatus: subscription?.planStatus ?? "active",
                currentPeriodEnd: subscription?.currentPeriodEnd ?? row.currentPeriodEnd,
                cancelAtPeriodEnd: Boolean(subscription?.cancelAtPeriodEnd)
              }
            : row
        )
      );
      setGrantNotice((current) => ({
        ...current,
        [userId]: { ok: true, message: "Pro granted." }
      }));
    }

    setGranting(null);
  };

  const toggle = async (userId) => {
    if (expanded === userId) {
      setExpanded(null);
      return;
    }
    setExpanded(userId);
    if (details[userId]) return;

    setDetails((current) => ({ ...current, [userId]: { loading: true } }));
    const { detail, error: detailError } = await fetchAdminUserDetail(userId);
    setDetails((current) => ({
      ...current,
      [userId]: { loading: false, error: detailError, ...detail }
    }));
  };

  const load = async () => {
    setLoading(true);
    const { users: rows, generatedAt: at, error: loadError } = await fetchAdminUsers();
    setUsers(rows);
    setGeneratedAt(at ?? null);
    setError(loadError);
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const totals = useMemo(
    () => ({
      users: users.length,
      pro: users.filter((user) => user.plan === "pro").length,
      unconfirmed: users.filter((user) => !user.confirmed).length,
      neverSignedIn: users.filter((user) => !user.lastSignInAt).length
    }),
    [users]
  );

  if (loading) {
    return (
      <>
        <AppNav />
        <main className="settings-shell">
          <div className="empty-workspace-panel">
            <img src="/logo.png" alt="Contest Hunter" className="logo-img-lg" />
            <h2>Loading accounts…</h2>
          </div>
        </main>
      </>
    );
  }

  return (
    <>
      <AppNav />
      <main className="settings-shell">
        <div className="settings-heading">
          <p className="eyebrow">
            Admin{generatedAt ? ` · generated ${formatDateTime(generatedAt)}` : ""}
          </p>
          <h1>Accounts</h1>
        </div>

        {error && <p className="data-notice">{error}</p>}

        <div className="stat-row">
          <div className="stat-tile">
            <strong>{totals.users}</strong>
            <span>Accounts</span>
          </div>
          <div className="stat-tile">
            <strong>{totals.pro}</strong>
            <span>On Pro</span>
          </div>
          <div className="stat-tile">
            <strong>{totals.unconfirmed}</strong>
            <span>Unconfirmed</span>
          </div>
          <div className="stat-tile">
            <strong>{totals.neverSignedIn}</strong>
            <span>Never signed in</span>
          </div>
        </div>

        <button className="quiet-link icon-inline" onClick={load}>
          <RefreshCw size={14} />
          Refresh
        </button>

        <div className="admin-list">
          {users.map((user) => {
            const open = expanded === user.id;
            const latest = user.logins[0];
            const detail = details[user.id];

            return (
              <article className="admin-card" key={user.id}>
                <button className="admin-card-head" onClick={() => toggle(user.id)} aria-expanded={open}>
                  <div className="admin-identity">
                    <strong>{user.email}</strong>
                    <span>{user.fullName || "No name set"}</span>
                  </div>

                  <div className="admin-badges">
                    {user.isAdmin && (
                      <span className="plan-badge">
                        <UserCog size={12} /> Admin
                      </span>
                    )}
                    {user.plan === "pro" ? (
                      <span className="plan-badge pro">
                        <Sparkles size={12} /> Pro
                      </span>
                    ) : (
                      <span className="plan-badge">Free</span>
                    )}
                    {!user.confirmed && (
                      <span className="plan-badge warn">
                        <ShieldAlert size={12} /> Unconfirmed
                      </span>
                    )}
                  </div>

                  <div className="admin-lastseen">
                    <Clock size={13} />
                    {user.lastSignInAt ? relativeFromNow(user.lastSignInAt) : "never"}
                  </div>
                </button>

                {open && (
                  <div className="admin-card-body">
                    <ul className="data-rows">
                      <li>
                        <span>Signed up</span>
                        <strong>{formatDateTime(user.createdAt)}</strong>
                      </li>
                      <li>
                        <span>Last sign-in</span>
                        <strong>{formatDateTime(user.lastSignInAt)}</strong>
                      </li>
                      <li>
                        <span>Sign-in method</span>
                        <strong>{user.provider}</strong>
                      </li>
                      <li>
                        <span>Email confirmed</span>
                        <strong>{user.confirmed ? "Yes" : "No"}</strong>
                      </li>
                      <li>
                        <span>Plan</span>
                        <strong className="admin-plan-cell">
                          <span>
                            {user.plan}
                            {user.planStatus ? ` · ${user.planStatus}` : ""}
                            {user.cancelAtPeriodEnd ? " · cancelling" : ""}
                          </span>
                          {user.plan !== "pro" && (
                            <button
                              type="button"
                              className="secondary-button admin-grant-button"
                              onClick={() => grant(user.id)}
                              disabled={granting === user.id}
                            >
                              <Sparkles size={12} />
                              {granting === user.id ? "Granting…" : "Grant Pro"}
                            </button>
                          )}
                          {grantNotice[user.id] && (
                            <em
                              className={
                                grantNotice[user.id].ok ? "admin-grant-ok" : "admin-grant-error"
                              }
                            >
                              {grantNotice[user.id].message}
                            </em>
                          )}
                        </strong>
                      </li>
                      {user.currentPeriodEnd && (
                        <li>
                          <span>Renews</span>
                          <strong>{formatTimestamp(user.currentPeriodEnd)}</strong>
                        </li>
                      )}
                      <li>
                        <span>Contests tracked</span>
                        <strong>
                          {user.tracking.total} ({user.tracking.inProgress} in progress ·{" "}
                          {user.tracking.completed} done · {user.tracking.saved} saved)
                        </strong>
                      </li>
                      <li>
                        <span>Answer drafts</span>
                        <strong>{user.draftCount}</strong>
                      </li>
                      <li>
                        <span>Default tone</span>
                        <strong>{user.defaultTone ?? "—"}</strong>
                      </li>
                    </ul>

                    <p className="eyebrow">Recent sign-ins</p>
                    {user.logins.length === 0 ? (
                      <p className="field-hint">
                        No sign-ins recorded yet. History starts from the first login after this
                        console was deployed — earlier sessions were never logged.
                      </p>
                    ) : (
                      <ul className="admin-logins">
                        {user.logins.map((login) => (
                          <li key={`${login.occurredAt}-${login.ip}`}>
                            <Monitor size={14} />
                            <span>{describeDevice(login.userAgent)}</span>
                            <code>{login.ip ?? "no ip"}</code>
                            <em>{formatDateTime(login.occurredAt)}</em>
                          </li>
                        ))}
                      </ul>
                    )}
                    {latest && (
                      <p className="field-hint">
                        <BadgeCheck size={13} /> Most recent device:{" "}
                        {describeDevice(latest.userAgent)}
                      </p>
                    )}

                    <AccountDetail detail={detail} />
                  </div>
                )}
              </article>
            );
          })}
        </div>
      </main>
    </>
  );
}

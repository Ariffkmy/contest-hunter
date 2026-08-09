import React, { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { RotateCcw, Trash2, Trophy } from "lucide-react";
import AppNav from "../components/AppNav.jsx";
import { useAuth } from "../auth/AuthProvider.jsx";
import { fetchDashboard } from "../services/contestsRepo.js";
import { applyHidden, purge, readHidden, restore, restoreAll } from "../services/hiddenContests.js";
import { relativeFromNow } from "../services/deadlines.js";

const statusLabels = {
  upcoming: "Not started",
  in_progress: "In progress",
  completed: "Completed"
};

export default function Deleted() {
  const { user } = useAuth();
  const [rows, setRows] = useState([]);
  const [hidden, setHidden] = useState(readHidden);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { contests } = await fetchDashboard(user.id);
      if (!cancelled) {
        setRows(contests);
        setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [user.id]);

  const deleted = useMemo(
    () =>
      applyHidden(rows, hidden)
        .filter((c) => c.deleted)
        .sort((a, b) => String(b.deletedAt).localeCompare(String(a.deletedAt))),
    [rows, hidden]
  );

  const confirmPurge = (contest) => {
    const ok = window.confirm(
      `Delete "${contest.brand}" permanently? This can't be undone without clearing your data.`
    );
    if (ok) setHidden(purge(hidden, contest.id));
  };

  if (loading) {
    return (
      <>
        <AppNav />
        <main className="settings-shell">
          <div className="empty-workspace-panel">
            <Trophy size={32} />
            <h2>Loading…</h2>
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
          <p className="eyebrow">Data</p>
          <h1>Deleted contests</h1>
        </div>

        {deleted.length === 0 ? (
          <div className="empty-workspace-panel">
            <Trash2 size={28} />
            <h2>Nothing deleted</h2>
            <p>
              Contests you delete from <Link to="/app">your board</Link> land here, and stay
              restorable.
            </p>
          </div>
        ) : (
          <>
            <div className="deleted-banner">
              <span>
                {deleted.length} contest{deleted.length === 1 ? "" : "s"} hidden from your board
              </span>
              <button className="quiet-link" onClick={() => setHidden(restoreAll(hidden))}>
                Restore all
              </button>
            </div>

            <div className="deleted-list">
              {deleted.map((contest) => (
                <article className="deleted-card" key={contest.id}>
                  <div>
                    <h3>{contest.brand}</h3>
                    <p>{contest.prize}</p>
                    <p className="field-hint">
                      {statusLabels[contest.status]} · deleted {relativeFromNow(contest.deletedAt)}
                    </p>
                  </div>
                  <div className="deleted-actions">
                    <button
                      className="complete-button"
                      onClick={() => setHidden(restore(hidden, contest.id))}
                    >
                      <RotateCcw size={15} />
                      Restore
                    </button>
                    <button className="secondary-button" onClick={() => confirmPurge(contest)}>
                      <Trash2 size={15} />
                      Delete
                    </button>
                  </div>
                </article>
              ))}
            </div>
          </>
        )}

        <p className="field-hint">
          Deleting only hides a contest on this device — it doesn't change the shared catalogue, and
          it doesn't sync to the mobile app.
        </p>
      </main>
    </>
  );
}

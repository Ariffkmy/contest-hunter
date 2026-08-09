// Soft delete, stored per-device in localStorage.
//
// Deliberately not in Postgres: public.user_contests has no column for it, and
// hiding a contest reads as a view preference rather than shared state. The
// mobile app makes the same call with AsyncStorage, so the two stay consistent
// in behaviour even though the stores differ.
//
// Shape: { [contestId]: deletedAtISO } for soft-deleted, plus a purged list of
// ids the user removed for good.

const KEY = "contest-hunter:hidden:v1";

const EMPTY = { deleted: {}, purgedIds: [] };

export function readHidden() {
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return EMPTY;
    const parsed = JSON.parse(raw);
    return {
      deleted: parsed.deleted ?? {},
      purgedIds: parsed.purgedIds ?? []
    };
  } catch {
    return EMPTY;
  }
}

export function writeHidden(next) {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    // Private browsing or a full quota — hiding silently stops persisting
    // rather than breaking the page.
  }
  return next;
}

export function softDelete(state, id) {
  return writeHidden({
    ...state,
    deleted: { ...state.deleted, [id]: new Date().toISOString() }
  });
}

export function restore(state, id) {
  const deleted = { ...state.deleted };
  delete deleted[id];
  return writeHidden({ ...state, deleted });
}

export function restoreAll(state) {
  return writeHidden({ ...state, deleted: {} });
}

/** Permanent: the id goes on a tombstone list so it stays gone across reloads. */
export function purge(state, id) {
  const deleted = { ...state.deleted };
  delete deleted[id];
  return writeHidden({
    ...state,
    deleted,
    purgedIds: state.purgedIds.includes(id) ? state.purgedIds : [...state.purgedIds, id]
  });
}

/** Applies the overlay to rows from contestsRepo. */
export function applyHidden(contests, state) {
  const purged = new Set(state.purgedIds);
  return contests
    .filter((c) => !purged.has(c.id))
    .map((c) => ({
      ...c,
      deleted: Boolean(state.deleted[c.id]),
      deletedAt: state.deleted[c.id] ?? null
    }));
}

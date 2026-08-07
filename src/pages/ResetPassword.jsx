import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthProvider.jsx";
import { AuthShell, FormError } from "./AuthShell.jsx";

const MIN_PASSWORD_LENGTH = 8;

/**
 * Reached from the emailed recovery link. Supabase's detectSessionInUrl has
 * already exchanged the token for a session by the time this renders, so the
 * update below is an ordinary authenticated call.
 */
export default function ResetPassword() {
  const { updatePassword, session, loading } = useAuth();
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError("");

    if (password.length < MIN_PASSWORD_LENGTH) {
      setError(`Password must be at least ${MIN_PASSWORD_LENGTH} characters.`);
      return;
    }
    if (password !== confirm) {
      setError("Those passwords do not match.");
      return;
    }

    setBusy(true);
    const { error: updateError } = await updatePassword(password);
    setBusy(false);
    if (updateError) {
      setError(updateError.message);
      return;
    }
    navigate("/app", { replace: true });
  };

  if (!loading && !session) {
    return (
      <AuthShell title="Link expired" subtitle="Request a fresh reset link to continue.">
        <button className="generate-button" onClick={() => navigate("/forgot-password")}>
          Get a new link
        </button>
      </AuthShell>
    );
  }

  return (
    <AuthShell title="Choose a new password">
      <form className="auth-form" onSubmit={handleSubmit}>
        <label className="field-label" htmlFor="password">
          New password
        </label>
        <input
          id="password"
          type="password"
          autoComplete="new-password"
          required
          value={password}
          onChange={(event) => setPassword(event.target.value)}
        />

        <label className="field-label" htmlFor="confirm">
          Confirm password
        </label>
        <input
          id="confirm"
          type="password"
          autoComplete="new-password"
          required
          value={confirm}
          onChange={(event) => setConfirm(event.target.value)}
        />

        <FormError>{error}</FormError>

        <button className="generate-button" type="submit" disabled={busy}>
          {busy ? "Saving…" : "Save password"}
        </button>
      </form>
    </AuthShell>
  );
}

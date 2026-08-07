import React, { useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../auth/AuthProvider.jsx";
import { AuthShell, FormError, FormNotice } from "./AuthShell.jsx";

export default function ForgotPassword() {
  const { sendPasswordReset } = useAuth();
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);

  const handleSubmit = async (event) => {
    event.preventDefault();
    setBusy(true);
    setError("");
    const { error: resetError } = await sendPasswordReset(email.trim());
    setBusy(false);
    if (resetError) {
      setError(resetError.message);
      return;
    }
    // Deliberately unconditional: confirming which addresses exist would let
    // anyone enumerate accounts.
    setSent(true);
  };

  return (
    <AuthShell
      title="Reset your password"
      subtitle="We'll email you a link to set a new one."
      footer={<Link to="/login">Back to sign in</Link>}
    >
      {sent ? (
        <FormNotice>
          If an account exists for {email.trim()}, a reset link is on its way.
        </FormNotice>
      ) : (
        <form className="auth-form" onSubmit={handleSubmit}>
          <label className="field-label" htmlFor="email">
            Email
          </label>
          <input
            id="email"
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(event) => setEmail(event.target.value)}
          />

          <FormError>{error}</FormError>

          <button className="generate-button" type="submit" disabled={busy}>
            {busy ? "Sending…" : "Send reset link"}
          </button>
        </form>
      )}
    </AuthShell>
  );
}

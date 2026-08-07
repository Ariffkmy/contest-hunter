import React, { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthProvider.jsx";
import { AuthShell, FormError, GoogleButton } from "./AuthShell.jsx";

export default function Login() {
  const { signIn, signInWithGoogle } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  // Send the user back to whatever they were trying to reach.
  const destination = location.state?.from ?? "/app";

  const handleSubmit = async (event) => {
    event.preventDefault();
    setBusy(true);
    setError("");
    const { error: signInError } = await signIn(email.trim(), password);
    setBusy(false);
    if (signInError) {
      setError(signInError.message);
      return;
    }
    navigate(destination, { replace: true });
  };

  const handleGoogle = async () => {
    setError("");
    const { error: oauthError } = await signInWithGoogle();
    if (oauthError) setError(oauthError.message);
  };

  return (
    <AuthShell
      title="Welcome back"
      subtitle="Sign in to pick up where you left off."
      footer={
        <>
          No account yet? <Link to="/register">Create one</Link>
        </>
      }
    >
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

        <div className="label-row">
          <label className="field-label" htmlFor="password">
            Password
          </label>
          <Link className="quiet-link" to="/forgot-password">
            Forgot?
          </Link>
        </div>
        <input
          id="password"
          type="password"
          autoComplete="current-password"
          required
          value={password}
          onChange={(event) => setPassword(event.target.value)}
        />

        <FormError>{error}</FormError>

        <button className="generate-button" type="submit" disabled={busy}>
          {busy ? "Signing in…" : "Sign in"}
        </button>
      </form>

      <div className="auth-divider">
        <span>or</span>
      </div>
      <GoogleButton onClick={handleGoogle} disabled={busy} />
    </AuthShell>
  );
}

import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthProvider.jsx";
import { AuthShell, FormError, FormNotice } from "./AuthShell.jsx";

const MIN_PASSWORD_LENGTH = 8;

export default function Register() {
  const { signUp } = useAuth();
  const navigate = useNavigate();
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError("");
    setNotice("");

    if (password.length < MIN_PASSWORD_LENGTH) {
      setError(`Password must be at least ${MIN_PASSWORD_LENGTH} characters.`);
      return;
    }

    setBusy(true);
    const { data, error: signUpError } = await signUp(email.trim(), password, fullName.trim());
    setBusy(false);

    if (signUpError) {
      setError(signUpError.message);
      return;
    }

    // With email confirmation on, signUp returns a user but no session. Say so
    // rather than dropping the user on a dashboard they cannot load yet.
    if (!data.session) {
      setNotice(`Check ${email.trim()} for a confirmation link to finish signing up.`);
      return;
    }
    navigate("/app", { replace: true });
  };

  return (
    <AuthShell
      title="Create your account"
      subtitle="Free plan tracks up to 5 contests. No card needed."
      footer={
        <>
          Already have an account? <Link to="/login">Sign in</Link>
        </>
      }
    >
      <form className="auth-form" onSubmit={handleSubmit}>
        <label className="field-label" htmlFor="name">
          Name
        </label>
        <input
          id="name"
          type="text"
          autoComplete="name"
          value={fullName}
          onChange={(event) => setFullName(event.target.value)}
        />

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

        <label className="field-label" htmlFor="password">
          Password
        </label>
        <input
          id="password"
          type="password"
          autoComplete="new-password"
          required
          minLength={MIN_PASSWORD_LENGTH}
          value={password}
          onChange={(event) => setPassword(event.target.value)}
        />
        <p className="field-hint">At least {MIN_PASSWORD_LENGTH} characters.</p>

        <FormError>{error}</FormError>
        <FormNotice>{notice}</FormNotice>

        <button className="generate-button" type="submit" disabled={busy}>
          {busy ? "Creating account…" : "Create account"}
        </button>
      </form>

    </AuthShell>
  );
}

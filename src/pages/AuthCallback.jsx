import React, { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthProvider.jsx";

/**
 * Landing spot for OAuth redirects and email confirmation links. The client
 * parses the tokens out of the URL on its own; this page just waits for the
 * resulting session and forwards.
 */
export default function AuthCallback() {
  const { session, loading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (loading) return;
    navigate(session ? "/app" : "/login", { replace: true });
  }, [loading, session, navigate]);

  return (
    <main className="auth-shell">
      <section className="auth-card auth-card-centered">
        <img src="/logo.png" alt="Contest Hunter" className="logo-img-lg" />
        <h2>Signing you in…</h2>
      </section>
    </main>
  );
}

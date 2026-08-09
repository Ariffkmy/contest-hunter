import React from "react";
import { BrowserRouter, Navigate, Route, Routes, useLocation } from "react-router-dom";
import { Trophy } from "lucide-react";
import { AuthProvider, useAuth } from "./auth/AuthProvider.jsx";
import { isConfigured } from "./services/supabaseClient.js";
import Login from "./pages/Login.jsx";
import Register from "./pages/Register.jsx";
import ForgotPassword from "./pages/ForgotPassword.jsx";
import ResetPassword from "./pages/ResetPassword.jsx";
import AuthCallback from "./pages/AuthCallback.jsx";
import Dashboard from "./pages/Dashboard.jsx";
import Home from "./pages/Home.jsx";
import Deleted from "./pages/Deleted.jsx";
import Settings from "./pages/Settings.jsx";
import Pricing from "./pages/Pricing.jsx";

function FullPageMessage({ title, children }) {
  return (
    <main className="auth-shell">
      <section className="auth-card auth-card-centered">
        <Trophy size={28} />
        <h2>{title}</h2>
        {children}
      </section>
    </main>
  );
}

function RequireAuth({ children }) {
  const { session, loading } = useAuth();
  const location = useLocation();

  if (loading) return <FullPageMessage title="Loading…" />;
  if (!session) {
    // Remember the target so login can send them back to it.
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }
  return children;
}

function RedirectIfSignedIn({ children }) {
  const { session, loading } = useAuth();
  if (loading) return <FullPageMessage title="Loading…" />;
  if (session) return <Navigate to="/home" replace />;
  return children;
}

export default function App() {
  if (!isConfigured) {
    return (
      <FullPageMessage title="Not configured">
        <p>
          Set <code>VITE_SUPABASE_URL</code> and <code>VITE_SUPABASE_ANON_KEY</code> in your
          <code>.env</code>, then restart the dev server.
        </p>
      </FullPageMessage>
    );
  }

  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route
            path="/login"
            element={
              <RedirectIfSignedIn>
                <Login />
              </RedirectIfSignedIn>
            }
          />
          <Route
            path="/register"
            element={
              <RedirectIfSignedIn>
                <Register />
              </RedirectIfSignedIn>
            }
          />
          <Route
            path="/forgot-password"
            element={
              <RedirectIfSignedIn>
                <ForgotPassword />
              </RedirectIfSignedIn>
            }
          />
          {/* Not wrapped: arriving here always carries a fresh recovery session. */}
          <Route path="/reset-password" element={<ResetPassword />} />
          <Route path="/auth/callback" element={<AuthCallback />} />

          <Route
            path="/home"
            element={
              <RequireAuth>
                <Home />
              </RequireAuth>
            }
          />
          <Route
            path="/deleted"
            element={
              <RequireAuth>
                <Deleted />
              </RequireAuth>
            }
          />

          <Route
            path="/app"
            element={
              <RequireAuth>
                <Dashboard />
              </RequireAuth>
            }
          />
          <Route
            path="/settings"
            element={
              <RequireAuth>
                <Settings />
              </RequireAuth>
            }
          />
          <Route
            path="/pricing"
            element={
              <RequireAuth>
                <Pricing />
              </RequireAuth>
            }
          />

          <Route path="*" element={<Navigate to="/home" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}

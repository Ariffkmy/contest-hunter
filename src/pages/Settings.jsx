import React, { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { CreditCard, Sparkles } from "lucide-react";
import AppNav from "../components/AppNav.jsx";
import { useAuth } from "../auth/AuthProvider.jsx";
import { supabase } from "../services/supabaseClient.js";
import { openBillingPortal } from "../services/billing.js";
import { FormError, FormNotice } from "./AuthShell.jsx";

const MIN_PASSWORD_LENGTH = 8;

export default function Settings() {
  const { user, profile, subscription, isPro, refreshAccount, updatePassword, signOut } = useAuth();
  const navigate = useNavigate();

  const [fullName, setFullName] = useState("");
  const [defaultTone, setDefaultTone] = useState("Warm");
  const [personalNote, setPersonalNote] = useState("");
  const [profileState, setProfileState] = useState({ busy: false, error: "", notice: "" });

  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [passwordState, setPasswordState] = useState({ busy: false, error: "", notice: "" });

  const [portalState, setPortalState] = useState({ busy: false, error: "" });

  useEffect(() => {
    if (!profile) return;
    setFullName(profile.full_name ?? "");
    setDefaultTone(profile.default_tone ?? "Warm");
    setPersonalNote(profile.personal_note ?? "");
  }, [profile]);

  const saveProfile = async (event) => {
    event.preventDefault();
    setProfileState({ busy: true, error: "", notice: "" });

    const { error } = await supabase
      .from("profiles")
      .update({
        full_name: fullName.trim() || null,
        default_tone: defaultTone,
        personal_note: personalNote
      })
      .eq("id", user.id);

    if (error) {
      setProfileState({ busy: false, error: error.message, notice: "" });
      return;
    }
    await refreshAccount();
    setProfileState({ busy: false, error: "", notice: "Saved." });
  };

  const changePassword = async (event) => {
    event.preventDefault();
    setPasswordState({ busy: false, error: "", notice: "" });

    if (password.length < MIN_PASSWORD_LENGTH) {
      setPasswordState({
        busy: false,
        error: `Password must be at least ${MIN_PASSWORD_LENGTH} characters.`,
        notice: ""
      });
      return;
    }
    if (password !== confirm) {
      setPasswordState({ busy: false, error: "Those passwords do not match.", notice: "" });
      return;
    }

    setPasswordState({ busy: true, error: "", notice: "" });
    const { error } = await updatePassword(password);
    if (error) {
      setPasswordState({ busy: false, error: error.message, notice: "" });
      return;
    }
    setPassword("");
    setConfirm("");
    setPasswordState({ busy: false, error: "", notice: "Password updated." });
  };

  const manageBilling = async () => {
    setPortalState({ busy: true, error: "" });
    const { url, error } = await openBillingPortal();
    if (error) {
      setPortalState({ busy: false, error });
      return;
    }
    window.location.href = url;
  };

  const handleSignOut = async () => {
    await signOut();
    navigate("/login", { replace: true });
  };

  return (
    <>
      <AppNav />
      <main className="settings-shell">
        <div className="settings-heading">
          <p className="eyebrow">Account</p>
          <h1>Settings</h1>
        </div>

        <section className="tool-panel">
          <div className="panel-heading">
            <div>
              <p className="eyebrow">Profile</p>
              <h3>Your details and answer defaults</h3>
            </div>
          </div>

          <form className="auth-form" onSubmit={saveProfile}>
            <label className="field-label" htmlFor="email">
              Email
            </label>
            <input id="email" type="email" value={user?.email ?? ""} disabled />
            <p className="field-hint">Contact support to change the address on the account.</p>

            <label className="field-label" htmlFor="fullName">
              Name
            </label>
            <input
              id="fullName"
              type="text"
              value={fullName}
              onChange={(event) => setFullName(event.target.value)}
            />

            <label className="field-label" htmlFor="tone">
              Default tone
            </label>
            <div className="tone-row" role="group" aria-label="Default tone">
              {["Warm", "Funny", "Premium", "Bold"].map((toneName) => (
                <button
                  key={toneName}
                  type="button"
                  className={defaultTone === toneName ? "tone active" : "tone"}
                  onClick={() => setDefaultTone(toneName)}
                >
                  {toneName}
                </button>
              ))}
            </div>

            <label className="field-label" htmlFor="personalNote">
              Default personal angle
            </label>
            <textarea
              id="personalNote"
              rows={4}
              value={personalNote}
              onChange={(event) => setPersonalNote(event.target.value)}
              placeholder="Pre-fills the answer workspace for every contest."
            />

            <FormError>{profileState.error}</FormError>
            <FormNotice>{profileState.notice}</FormNotice>

            <button className="generate-button" type="submit" disabled={profileState.busy}>
              {profileState.busy ? "Saving…" : "Save profile"}
            </button>
          </form>
        </section>

        <section className="tool-panel">
          <div className="panel-heading">
            <div>
              <p className="eyebrow">Billing</p>
              <h3>{isPro ? "Pro plan" : "Free plan"}</h3>
            </div>
            {isPro ? <Sparkles size={20} /> : <CreditCard size={20} />}
          </div>

          {isPro ? (
            <>
              <p className="field-hint">
                {subscription?.cancel_at_period_end
                  ? "Your subscription ends"
                  : "Renews"}{" "}
                {subscription?.current_period_end
                  ? new Date(subscription.current_period_end).toLocaleDateString()
                  : "—"}
                .
              </p>
              <FormError>{portalState.error}</FormError>
              <button
                className="secondary-button"
                onClick={manageBilling}
                disabled={portalState.busy}
              >
                {portalState.busy ? "Opening…" : "Manage subscription"}
              </button>
            </>
          ) : (
            <>
              <p className="field-hint">
                Tracking up to 5 contests, with template drafts. Pro removes the limit and writes
                real AI drafts.
              </p>
              <Link className="generate-button" to="/pricing">
                Upgrade to Pro
              </Link>
            </>
          )}
        </section>

        <section className="tool-panel">
          <div className="panel-heading">
            <div>
              <p className="eyebrow">Security</p>
              <h3>Change password</h3>
            </div>
          </div>

          <form className="auth-form" onSubmit={changePassword}>
            <label className="field-label" htmlFor="newPassword">
              New password
            </label>
            <input
              id="newPassword"
              type="password"
              autoComplete="new-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
            />

            <label className="field-label" htmlFor="confirmPassword">
              Confirm password
            </label>
            <input
              id="confirmPassword"
              type="password"
              autoComplete="new-password"
              value={confirm}
              onChange={(event) => setConfirm(event.target.value)}
            />

            <FormError>{passwordState.error}</FormError>
            <FormNotice>{passwordState.notice}</FormNotice>

            <button className="secondary-button" type="submit" disabled={passwordState.busy}>
              {passwordState.busy ? "Updating…" : "Update password"}
            </button>
          </form>
        </section>

        <section className="tool-panel">
          <div className="panel-heading">
            <div>
              <p className="eyebrow">Session</p>
              <h3>Sign out</h3>
            </div>
          </div>
          <button className="secondary-button" onClick={handleSignOut}>
            Sign out of this device
          </button>
        </section>
      </main>
    </>
  );
}

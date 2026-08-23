import React, { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Check, Sparkles } from "lucide-react";
import AppNav from "../components/AppNav.jsx";
import { useAuth } from "../auth/AuthProvider.jsx";
import { startCheckout } from "../services/billing.js";
import { FormError, FormNotice } from "./AuthShell.jsx";

const freeFeatures = [
  "Browse every scraped giveaway",
  "Track up to 5 contests",
  "Template answer drafts",
  "Entry requirement checklists"
];

const proFeatures = [
  "Unlimited tracked contests",
  "AI-written answer drafts",
  "Saved draft history",
  "Priority on new scrapes"
];

export default function Pricing() {
  const { isPro, refreshAccount } = useAuth();
  const [searchParams] = useSearchParams();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const checkoutResult = searchParams.get("checkout");

  // Stripe redirects back before the webhook has necessarily landed, so pull
  // the subscription again rather than trusting the URL alone.
  useEffect(() => {
    if (checkoutResult !== "success") return;
    const timer = window.setTimeout(refreshAccount, 1500);
    return () => window.clearTimeout(timer);
  }, [checkoutResult, refreshAccount]);

  const upgrade = async () => {
    setBusy(true);
    setError("");
    const { url, error: checkoutError } = await startCheckout();
    if (checkoutError) {
      setBusy(false);
      setError(checkoutError);
      return;
    }
    window.location.href = url;
  };

  return (
    <>
      <AppNav />
      <main className="settings-shell">
        <div className="settings-heading">
          <p className="eyebrow">Plans</p>
          <h1>Enter more, win more</h1>
        </div>

        {checkoutResult === "success" && (
          <FormNotice>
            Payment received. Your plan updates as soon as Stripe confirms — refresh in a moment if
            it still says Free.
          </FormNotice>
        )}
        {checkoutResult === "cancelled" && <FormNotice>Checkout cancelled. No charge made.</FormNotice>}
        <FormError>{error}</FormError>

        <div className="plan-grid">
          <section className="plan-card">
            <p className="eyebrow">Free</p>
            <h2>
              RM0<span>/month</span>
            </h2>
            <ul>
              {freeFeatures.map((feature) => (
                <li key={feature}>
                  <Check size={15} />
                  {feature}
                </li>
              ))}
            </ul>
            {!isPro && <p className="field-hint">Your current plan.</p>}
          </section>

          <section className={isPro ? "plan-card featured current" : "plan-card featured"}>
            <p className="eyebrow">
              <Sparkles size={14} /> Pro
            </p>
            <h2>
              RM89<span>/month</span>
            </h2>
            <ul>
              {proFeatures.map((feature) => (
                <li key={feature}>
                  <Check size={15} />
                  {feature}
                </li>
              ))}
            </ul>

            {isPro ? (
              <>
                <p className="field-hint">You're on Pro.</p>
                <Link className="secondary-button" to="/settings">
                  Manage subscription
                </Link>
              </>
            ) : (
              <button className="generate-button" onClick={upgrade} disabled={busy}>
                {busy ? "Opening checkout…" : "Upgrade to Pro"}
              </button>
            )}
          </section>
        </div>

        <p className="field-hint centered">
          Cancel anytime from Settings. Billing is handled by Stripe; we never see your card.
        </p>
      </main>
    </>
  );
}

import React from "react";
import { Link } from "react-router-dom";
import {
  AlarmClock,
  BarChart3,
  CheckCircle2,
  Crown,
  Gauge,
  Gift,
  Instagram,
  Lock,
  MessageSquareText,
  PenLine,
  Sparkles,
  Target,
  Trophy,
  Wand2,
} from "lucide-react";
import { useAuth } from "../auth/AuthProvider.jsx";

/**
 * Public marketing landing page served at "/".
 * Signed-out visitors see the pitch + sign-up CTAs; signed-in users get
 * bounced straight into the app.
 */
export default function Landing() {
  const { session } = useAuth();

  // Already signed in? Straight to the board.
  if (session) {
    return (
      <main className="landing">
        <section className="landing-hero">
          <div className="landing-hero-inner">
            <div className="logo-mark landing-logo">
              <Trophy size={22} />
            </div>
            <h1>Welcome back to Contest Hunter</h1>
            <p className="landing-sub">Your board is waiting — jump back in.</p>
            <Link className="generate-button landing-cta" to="/home">
              Open my board →
            </Link>
          </div>
        </section>
      </main>
    );
  }

  return (
    <main className="landing">
      {/* ===== Hero ===== */}
      <section className="landing-hero">
        <div className="landing-hero-inner">
          <div className="landing-nav">
            <div className="brand-row landing-brand">
              <div className="logo-mark">
                <Trophy size={20} />
              </div>
              <div>
                <h1>Contest Hunter</h1>
                <p>Track Instagram giveaways worth entering</p>
              </div>
            </div>
            <div className="landing-nav-actions">
              <Link className="quiet-link" to="/login">
                Log in
              </Link>
              <Link className="generate-button" to="/register">
                Get started
              </Link>
            </div>
          </div>

          <div className="landing-hero-grid">
            <div className="landing-hero-copy">
              <p className="eyebrow">
                <Sparkles size={13} /> Stop missing giveaways you could actually win
              </p>
              <h2>
                Never lose track of a <em>contest</em> worth entering again.
              </h2>
              <p className="landing-lead">
                Contest Hunter scrapes Instagram giveaways, keeps every deadline in one
                place, and drafts entry answers for you — so you enter more, forget less,
                and win more.
              </p>
              <div className="landing-cta-row">
                <Link className="generate-button landing-cta" to="/register">
                  Start hunting free
                </Link>
                <Link className="secondary-button" to="/pricing">
                  See pricing
                </Link>
              </div>
              <p className="landing-trust">Free forever plan · No credit card · Cancel anytime</p>
            </div>

            <div className="landing-hero-card">
              <div className="landing-card-top">
                <span className="landing-card-badge">
                  <AlarmClock size={13} /> Closing soon
                </span>
                <span className="landing-card-actions">
                  <Lock size={13} /> Pro
                </span>
              </div>
              <ul className="landing-card-list">
                <li>
                  <span className="landing-card-avatar" style={{ background: "#f0b84d" }}>
                    <Gift size={14} />
                  </span>
                  <span className="landing-card-main">
                    <strong>PASEO Malaysia</strong>
                    <span>Gift Set ×5</span>
                  </span>
                  <span className="landing-card-meta critical">today</span>
                </li>
                <li>
                  <span className="landing-card-avatar" style={{ background: "#7cc4c9" }}>
                    <Gift size={14} />
                  </span>
                  <span className="landing-card-main">
                    <strong>ZUS Coffee</strong>
                    <span>Proton e.MAS · LBS Home</span>
                  </span>
                  <span className="landing-card-meta">2d</span>
                </li>
                <li>
                  <span className="landing-card-avatar" style={{ background: "#c9a2e0" }}>
                    <Gift size={14} />
                  </span>
                  <span className="landing-card-main">
                    <strong>Nestlé</strong>
                    <span>Salary for Life · RM3.5k/mo</span>
                  </span>
                  <span className="landing-card-meta">3d</span>
                </li>
              </ul>
              <div className="landing-card-foot">
                <div className="progress-head">
                  <strong>72%</strong>
                  <span>8 of 11 entered</span>
                </div>
                <div className="progress-track">
                  <div className="progress-fill" style={{ width: "72%" }} />
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ===== Features ===== */}
      <section className="landing-section">
        <div className="landing-section-inner">
          <p className="eyebrow">Everything in one board</p>
          <h2 className="landing-section-title">Hunt less. Enter more. Win more.</h2>

          <div className="landing-features">
            <Feature
              icon={<Instagram size={20} />}
              title="Auto-scraped giveaways"
              copy="Instagram giveaways pulled into one feed — no more doom-scrolling hashtags hunting for the latest post."
            />
            <Feature
              icon={<AlarmClock size={20} />}
              title="Deadline radar"
              copy="Every closing date tracked. Know what's due today, tomorrow, or this week — before it slips past."
            />
            <Feature
              icon={<Wand2 size={20} />}
              title="AI-drafted answers"
              copy="Get a tailored entry answer for comment-based contests, tuned to your tone and the brand's angle."
            />
            <Feature
              icon={<Gauge size={20} />}
              title="Odds & analytics"
              copy="Spot the contests with the fewest entries. Ranked by engagement so you spend effort where it counts."
            />
            <Feature
              icon={<BarChart3 size={20} />}
              title="Progress insight"
              copy="Completion rate, contest-type breakdown, and averages — see how you're tracking at a glance."
            />
            <Feature
              icon={<Target size={20} />}
              title="Save & track"
              copy="Bookmark contests across devices. Your board syncs, so your progress follows you everywhere."
            />
          </div>
        </div>
      </section>

      {/* ===== How it works ===== */}
      <section className="landing-section landing-alt">
        <div className="landing-section-inner">
          <p className="eyebrow">How it works</p>
          <h2 className="landing-section-title">From post to entry in three steps</h2>

          <div className="landing-steps">
            <Step
              n="01"
              icon={<Instagram size={20} />}
              title="We find the giveaways"
              copy="The scraper watches Instagram and builds the catalog of active contests for you."
            />
            <Step
              n="02"
              icon={<PenLine size={20} />}
              title="You enter in minutes"
              copy="Pick a contest, follow the conditions, and use the AI draft to answer in seconds."
            />
            <Step
              n="03"
              icon={<Crown size={20} />}
              title="You actually win"
              copy="Track everything, never miss a deadline, and keep your entries organised in one board."
            />
          </div>
        </div>
      </section>

      {/* ===== CTA ===== */}
      <section className="landing-section landing-cta-band">
        <div className="landing-section-inner">
          <div className="landing-cta-card">
            <MessageSquareText size={28} className="landing-cta-icon" />
            <h2>Start winning giveaways today</h2>
            <p>
              Join for free and see what's closing this week. Upgrade anytime for AI answers
              and full analytics.
            </p>
            <div className="landing-cta-row">
              <Link className="generate-button landing-cta" to="/register">
                Create free account
              </Link>
              <Link className="quiet-link landing-cta-link" to="/login">
                Already have an account? Log in
              </Link>
            </div>
          </div>
        </div>
      </section>

      <footer className="landing-footer">
        <div className="landing-footer-inner">
          <div className="brand-row landing-brand">
            <div className="logo-mark">
              <Trophy size={18} />
            </div>
            <span>Contest Hunter</span>
          </div>
          <div className="landing-footer-links">
            <Link to="/login">Log in</Link>
            <Link to="/register">Sign up</Link>
            <Link to="/privacy.html">Privacy</Link>
          </div>
          <span className="landing-footer-note">© {new Date().getFullYear()} Contest Hunter</span>
        </div>
      </footer>
    </main>
  );
}

function Feature({ icon, title, copy }) {
  return (
    <div className="landing-feature">
      <div className="landing-feature-icon">{icon}</div>
      <h3>{title}</h3>
      <p>{copy}</p>
    </div>
  );
}

function Step({ n, icon, title, copy }) {
  return (
    <div className="landing-step">
      <div className="landing-step-num">{n}</div>
      <div className="landing-step-icon">{icon}</div>
      <h3>{title}</h3>
      <p>{copy}</p>
    </div>
  );
}

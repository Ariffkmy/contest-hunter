import React from "react";
import { Link, NavLink, useNavigate } from "react-router-dom";
import {
  LayoutDashboard,
  LogOut,
  Settings as SettingsIcon,
  Sparkles,
  Trophy,
  UserCog
} from "lucide-react";
import { useAuth } from "../auth/AuthProvider.jsx";

export default function AppNav() {
  const { profile, user, isPro, signOut } = useAuth();
  const navigate = useNavigate();

  const handleSignOut = async () => {
    await signOut();
    navigate("/login", { replace: true });
  };

  return (
    <header className="app-nav">
      <Link className="app-nav-brand" to="/app">
        <div className="logo-mark">
          <Trophy size={18} />
        </div>
        <span>Contest Hunter</span>
      </Link>

      <nav className="app-nav-links">
        <NavLink to="/home" className={({ isActive }) => (isActive ? "active" : undefined)}>
          <LayoutDashboard size={15} />
          Home
        </NavLink>
        <NavLink to="/app" className={({ isActive }) => (isActive ? "active" : undefined)}>
          Contests
        </NavLink>
        <NavLink to="/settings" className={({ isActive }) => (isActive ? "active" : undefined)}>
          <SettingsIcon size={15} />
          Settings
        </NavLink>
        {profile?.is_admin && (
          <NavLink to="/admin" className={({ isActive }) => (isActive ? "active" : undefined)}>
            <UserCog size={15} />
            Admin
          </NavLink>
        )}
      </nav>

      <div className="app-nav-account">
        {isPro ? (
          <span className="plan-badge pro">
            <Sparkles size={13} />
            Pro
          </span>
        ) : (
          <Link className="plan-badge" to="/pricing">
            Free — upgrade
          </Link>
        )}
        <span className="account-email" title={user?.email}>
          {profile?.full_name || user?.email}
        </span>
        <button className="icon-button" onClick={handleSignOut} title="Sign out">
          <LogOut size={16} />
        </button>
      </div>
    </header>
  );
}

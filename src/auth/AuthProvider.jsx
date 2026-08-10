import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { supabase } from "../services/supabaseClient.js";
import { recordLogin } from "../services/admin.js";

const AuthContext = createContext(null);

export function useAuth() {
  const value = useContext(AuthContext);
  if (!value) throw new Error("useAuth must be used inside <AuthProvider>");
  return value;
}

/**
 * Owns the session plus the two rows that hang off it: the user's profile and
 * their subscription. Both are provisioned by a database trigger at signup, so
 * a missing row here means the fetch failed rather than that the user is new.
 */
export function AuthProvider({ children }) {
  const [session, setSession] = useState(null);
  const [profile, setProfile] = useState(null);
  const [subscription, setSubscription] = useState(null);
  const [loading, setLoading] = useState(true);

  const userId = session?.user?.id ?? null;

  const loadAccount = useCallback(async (id) => {
    if (!id) {
      setProfile(null);
      setSubscription(null);
      return;
    }
    const [profileResult, subscriptionResult] = await Promise.all([
      supabase.from("profiles").select("*").eq("id", id).maybeSingle(),
      supabase.from("subscriptions").select("*").eq("user_id", id).maybeSingle()
    ]);
    setProfile(profileResult.data ?? null);
    setSubscription(subscriptionResult.data ?? null);
  }, []);

  useEffect(() => {
    let active = true;

    supabase.auth.getSession().then(({ data }) => {
      if (!active) return;
      setSession(data.session);
      loadAccount(data.session?.user?.id ?? null).finally(() => {
        if (active) setLoading(false);
      });
    });

    const { data: listener } = supabase.auth.onAuthStateChange((event, nextSession) => {
      setSession(nextSession);
      loadAccount(nextSession?.user?.id ?? null);

      // Only the real sign-in event: SIGNED_IN also fires on tab focus and on
      // token refresh in some versions, but INITIAL_SESSION covers the reload
      // case, so restricting to SIGNED_IN keeps the audit trail to actual logins.
      if (event === "SIGNED_IN") recordLogin();
    });

    return () => {
      active = false;
      listener.subscription.unsubscribe();
    };
  }, [loadAccount]);

  const value = useMemo(
    () => ({
      session,
      user: session?.user ?? null,
      profile,
      subscription,
      loading,
      // The webhook is the only writer of `plan`, so this is trustworthy for
      // display. Anything that actually costs money is re-checked server-side.
      //
      // `plan` is the raw value the entitlements table keys on, and matches the
      // mobile app's vocabulary. A missing row reads as free, never pro.
      plan: subscription?.plan ?? "free",
      isPro: subscription?.plan === "pro",
      // Display/routing only. Every admin read is re-authorised server-side.
      isAdmin: Boolean(profile?.is_admin),
      refreshAccount: () => loadAccount(userId),
      signUp: (email, password, fullName) =>
        supabase.auth.signUp({
          email,
          password,
          options: {
            data: { full_name: fullName },
            emailRedirectTo: `${window.location.origin}/auth/callback`
          }
        }),
      signIn: (email, password) => supabase.auth.signInWithPassword({ email, password }),
      // Kept, but no longer wired to a button: every OAuth provider is disabled
      // on the Supabase project, so the sign-in pages offered a control that
      // could only fail. Re-add <GoogleButton> to Login/Register once Google is
      // enabled in Authentication -> Providers.
      signInWithGoogle: () =>
        supabase.auth.signInWithOAuth({
          provider: "google",
          options: { redirectTo: `${window.location.origin}/auth/callback` }
        }),
      sendPasswordReset: (email) =>
        supabase.auth.resetPasswordForEmail(email, {
          redirectTo: `${window.location.origin}/reset-password`
        }),
      updatePassword: (password) => supabase.auth.updateUser({ password }),
      signOut: () => supabase.auth.signOut()
    }),
    [session, profile, subscription, loading, loadAccount, userId]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

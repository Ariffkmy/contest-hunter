-- Grant admin users update permission on subscriptions.
-- This allows the admin console to comp accounts onto Pro.

drop policy if exists "subscriptions: admins can update plan" on public.subscriptions;
create policy "subscriptions: admins can update plan"
  on public.subscriptions for update
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

grant update (plan, status, updated_at) on public.subscriptions to authenticated;
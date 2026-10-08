-- Pin search_path on the remaining functions and revoke EXECUTE from roles that never call them directly.

alter function public.ai_usage_this_month(text, uuid, text) set search_path = public;
alter function public.consume_metered_run(uuid, text, text, text, integer, bigint, integer) set search_path = public;
alter function public.record_ai_usage(text, text, uuid, uuid, text, integer, bigint) set search_path = public;
alter function public.guard_profile_billing() set search_path = public;

revoke execute on function public.guard_profile_billing() from public, anon, authenticated;
revoke execute on function public.enforce_workspace_owner() from public, anon, authenticated;
revoke execute on function public.handle_new_user() from public, anon, authenticated;
revoke execute on function public.is_active_workspace_member(uuid) from public, anon;

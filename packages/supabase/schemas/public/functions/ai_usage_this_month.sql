CREATE OR REPLACE FUNCTION public.ai_usage_this_month (
  p_surface text,
  p_owner   uuid,
  p_period  text
)
  RETURNS TABLE (
    messages bigint,
    tokens   bigint
  )
  LANGUAGE sql
  STABLE
  SET search_path TO 'public'
  AS $function$
  select
    coalesce(sum(u.messages), 0)::bigint as messages,
    coalesce(sum(u.tokens), 0)::bigint   as tokens
  from public.ai_usage u
  where coalesce(u.user_id, u.api_key_id) = p_owner
    and u.surface = p_surface
    and u.period = p_period;
$function$;

GRANT EXECUTE ON FUNCTION "public"."ai_usage_this_month"(text, uuid, text) TO "service_role";

REVOKE ALL ON FUNCTION "public"."ai_usage_this_month"(text, uuid, text) FROM PUBLIC, "anon", "authenticated";

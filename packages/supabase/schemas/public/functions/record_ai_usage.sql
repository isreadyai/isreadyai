CREATE OR REPLACE FUNCTION public.record_ai_usage (
  p_surface       text,
  p_period        text,
  p_user_id       uuid    DEFAULT NULL::uuid,
  p_api_key_id    uuid    DEFAULT NULL::uuid,
  p_generation_id text    DEFAULT NULL::text,
  p_messages      integer DEFAULT 0,
  p_tokens        bigint  DEFAULT 0
)
  RETURNS void
  LANGUAGE sql
  AS $function$
  insert into public.ai_usage (user_id, api_key_id, surface, period, generation_id, messages, tokens)
  values (p_user_id, p_api_key_id, p_surface, p_period, p_generation_id, p_messages, p_tokens)
  on conflict (generation_id) where generation_id is not null
  do nothing;
$function$;

GRANT EXECUTE ON FUNCTION "public"."record_ai_usage"(text, text, uuid, uuid, text, integer, bigint) TO "service_role";

REVOKE ALL ON FUNCTION "public"."record_ai_usage"(text, text, uuid, uuid, text, integer, bigint) FROM PUBLIC, "anon", "authenticated";

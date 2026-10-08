CREATE OR REPLACE FUNCTION public.consume_rate_limit (
  p_key       text,
  p_window_ms bigint,
  p_limit     integer
)
  RETURNS boolean
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public'
  AS $function$
declare
  v_start timestamptz;
  v_count integer;
begin
  v_start := to_timestamp(floor(extract(epoch from now()) * 1000 / p_window_ms) * p_window_ms / 1000.0);

  insert into public.rate_limit_counters (bucket_key, window_start, count)
  values (p_key, v_start, 1)
  on conflict (bucket_key, window_start)
  do update set count = public.rate_limit_counters.count + 1
  returning count into v_count;

  delete from public.rate_limit_counters
  where bucket_key = p_key and window_start < v_start;

  return v_count <= p_limit;
end;
$function$;

GRANT EXECUTE ON FUNCTION "public"."consume_rate_limit"(text, bigint, integer) TO "service_role";

REVOKE ALL ON FUNCTION "public"."consume_rate_limit"(text, bigint, integer) FROM PUBLIC, "anon", "authenticated";

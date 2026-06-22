-- isready.ai schema. Consolidated initial migration.
set search_path = public, extensions;
set check_function_bodies = false;

CREATE FUNCTION public.ai_usage_this_month(p_surface text, p_owner uuid, p_period text) RETURNS TABLE(messages bigint, tokens bigint)
    LANGUAGE sql STABLE
    AS $$
  select
    coalesce(sum(u.messages), 0)::bigint as messages,
    coalesce(sum(u.tokens), 0)::bigint   as tokens
  from public.ai_usage u
  where coalesce(u.user_id, u.api_key_id) = p_owner
    and u.surface = p_surface
    and u.period = p_period;
$$;

CREATE FUNCTION public.consume_metered_run(p_api_key_id uuid, p_kind text, p_repo text, p_url text, p_patches integer, p_window_ms bigint, p_limit integer) RETURNS uuid
    LANGUAGE plpgsql
    AS $$
declare
  v_workspace_id uuid;
  v_lock_key text;
  v_used integer;
  v_id uuid;
begin
  select workspace_id into v_workspace_id
  from public.api_keys
  where id = p_api_key_id;

  v_lock_key := case
    when v_workspace_id is not null then 'ws:' || v_workspace_id::text
    else 'key:' || p_api_key_id::text
  end;

  perform pg_advisory_xact_lock(hashtext(v_lock_key));

  if v_workspace_id is not null then
    select count(*) into v_used
    from public.fix_runs
    where workspace_id = v_workspace_id
      and created_at >= now() - make_interval(secs => p_window_ms / 1000.0);
  else
    select count(*) into v_used
    from public.fix_runs
    where api_key_id = p_api_key_id
      and created_at >= now() - make_interval(secs => p_window_ms / 1000.0);
  end if;

  if v_used >= p_limit then
    return null;
  end if;

  insert into public.fix_runs (api_key_id, workspace_id, repo, url, patches, kind)
  values (p_api_key_id, v_workspace_id, p_repo, p_url, p_patches, p_kind)
  returning id into v_id;

  return v_id;
end;
$$;

CREATE FUNCTION public.consume_rate_limit(p_key text, p_window_ms bigint, p_limit integer) RETURNS boolean
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
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
$$;

CREATE FUNCTION public.delete_stale_anonymous_users(p_retention_days integer DEFAULT 30) RETURNS integer
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
declare
  v_deleted integer;
begin
  delete from auth.users
  where is_anonymous is true
    and created_at < now() - make_interval(days => p_retention_days);
  get diagnostics v_deleted = row_count;
  return v_deleted;
end;
$$;

CREATE FUNCTION public.guard_profile_billing() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
begin
  -- Billing columns are owned by Stripe and only ever written by the webhook via
  -- the service role. A user session must never change them — even if a permissive
  -- UPDATE policy is one day added to profiles by mistake, this is the backstop.
  if current_user in ('authenticated', 'anon') and (
       new.plan is distinct from old.plan
    or new.stripe_customer_id is distinct from old.stripe_customer_id
    or new.stripe_subscription_id is distinct from old.stripe_subscription_id
    or new.subscription_status is distinct from old.subscription_status
    or new.subscription_current_period_end is distinct from old.subscription_current_period_end
    or new.cancel_at_period_end is distinct from old.cancel_at_period_end
    or new.payment_method_brand is distinct from old.payment_method_brand
    or new.payment_method_last4 is distinct from old.payment_method_last4
  ) then
    raise exception 'profiles billing columns are managed by Stripe and cannot be changed directly';
  end if;
  return new;
end;
$$;

CREATE FUNCTION public.handle_new_user() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
declare
  v_workspace_id uuid;
begin
  insert into public.profiles (id, email, terms_accepted_at)
  values (
    new.id,
    new.email,
    nullif(new.raw_user_meta_data ->> 'terms_accepted_at', '')::timestamptz
  )
  on conflict (id) do nothing;

  insert into public.workspaces (name, slug, created_by, plan)
  values (
    coalesce(new.email, 'My workspace'),
    'u-' || replace(new.id::text, '-', ''),
    new.id,
    'free'
  )
  on conflict (slug) do nothing
  returning id into v_workspace_id;

  if v_workspace_id is null then
    select id into v_workspace_id
    from public.workspaces
    where slug = 'u-' || replace(new.id::text, '-', '');
  end if;

  if v_workspace_id is not null then
    insert into public.workspace_members (workspace_id, user_id, role, status, joined_at)
    values (v_workspace_id, new.id, 'owner', 'active', now())
    on conflict (workspace_id, user_id) do nothing;
  end if;

  return new;
end;
$$;

CREATE FUNCTION public.is_active_workspace_member(ws uuid) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    AS $$
  select exists (
    select 1 from public.workspace_members
    where workspace_id = ws
      and user_id = (select auth.uid())
      and status = 'active'
  );
$$;

CREATE FUNCTION public.record_ai_usage(p_surface text, p_period text, p_user_id uuid DEFAULT NULL::uuid, p_api_key_id uuid DEFAULT NULL::uuid, p_generation_id text DEFAULT NULL::text, p_messages integer DEFAULT 0, p_tokens bigint DEFAULT 0) RETURNS void
    LANGUAGE sql
    AS $$
  insert into public.ai_usage (user_id, api_key_id, surface, period, generation_id, messages, tokens)
  values (p_user_id, p_api_key_id, p_surface, p_period, p_generation_id, p_messages, p_tokens)
  on conflict (generation_id) where generation_id is not null
  do nothing;
$$;

CREATE TABLE public.ai_usage (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid,
    api_key_id uuid,
    surface text NOT NULL,
    period text NOT NULL,
    generation_id text,
    messages integer DEFAULT 0 NOT NULL,
    tokens bigint DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT ai_usage_messages_check CHECK ((messages >= 0)),
    CONSTRAINT ai_usage_owner_present CHECK (((user_id IS NOT NULL) OR (api_key_id IS NOT NULL))),
    CONSTRAINT ai_usage_period_check CHECK ((period ~ '^[0-9]{6}$'::text)),
    CONSTRAINT ai_usage_surface_check CHECK ((surface = ANY (ARRAY['chat'::text, 'mcp'::text, 'solve'::text]))),
    CONSTRAINT ai_usage_tokens_check CHECK ((tokens >= 0))
);

CREATE TABLE public.api_keys (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    key_hash text NOT NULL,
    label text,
    user_id uuid,
    plan text DEFAULT 'free'::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    revoked_at timestamp with time zone,
    badge_domains text[] DEFAULT '{}'::text[] NOT NULL,
    workspace_id uuid,
    created_by uuid,
    prefix text,
    scopes text[] DEFAULT '{}'::text[] NOT NULL,
    expires_at timestamp with time zone,
    last_used_at timestamp with time zone,
    CONSTRAINT api_keys_plan_check CHECK ((plan = ANY (ARRAY['free'::text, 'pro'::text, 'team'::text])))
);

CREATE TABLE public.audit_events (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    workspace_id uuid NOT NULL,
    actor_user_id uuid,
    action text NOT NULL,
    target_type text,
    target_id uuid,
    metadata jsonb,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE public.chat_threads (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    host text NOT NULL,
    scan_id uuid,
    messages jsonb DEFAULT '[]'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    website_id uuid
);

CREATE TABLE public.ci_reports (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    repo_id uuid NOT NULL,
    scan_id uuid,
    branch text NOT NULL,
    commit_sha text NOT NULL,
    score integer,
    grade text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT ci_reports_score_check CHECK (((score IS NULL) OR ((score >= 0) AND (score <= 100))))
);

CREATE TABLE public.ci_repos (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    slug text NOT NULL,
    repository_id text NOT NULL,
    owner_repo text NOT NULL,
    api_key_id uuid,
    user_id uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE public.fix_runs (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    api_key_id uuid NOT NULL,
    repo text NOT NULL,
    url text NOT NULL,
    scan_id uuid,
    patches integer DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    workspace_id uuid,
    kind text,
    CONSTRAINT fix_runs_kind_check CHECK (((kind IS NULL) OR (kind = ANY (ARRAY['fix'::text, 'solve'::text, 'plan'::text]))))
);

CREATE TABLE public.leads (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    email text NOT NULL,
    scan_id uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE public.monitoring_schedules (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    website_id uuid NOT NULL,
    frequency text DEFAULT 'weekly'::text NOT NULL,
    timezone text DEFAULT 'UTC'::text NOT NULL,
    next_run_at timestamp with time zone,
    alert_threshold integer,
    alert_delta integer,
    paused_at timestamp with time zone,
    created_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    scan_mode text DEFAULT 'simple'::text NOT NULL,
    smart_agent_enabled boolean DEFAULT true NOT NULL,
    last_weekly_report_at timestamp with time zone,
    CONSTRAINT monitoring_schedules_frequency_check CHECK ((frequency = ANY (ARRAY['hourly'::text, 'daily'::text, 'weekly'::text]))),
    CONSTRAINT monitoring_schedules_scan_mode_check CHECK ((scan_mode = ANY (ARRAY['simple'::text, 'deep'::text])))
);

CREATE TABLE public.notification_preferences (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    workspace_id uuid NOT NULL,
    user_id uuid NOT NULL,
    event_type text NOT NULL,
    in_app boolean DEFAULT true NOT NULL,
    email boolean DEFAULT true NOT NULL,
    webhook boolean DEFAULT false NOT NULL,
    digest text DEFAULT 'immediate'::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT notification_preferences_digest_check CHECK ((digest = ANY (ARRAY['immediate'::text, 'daily'::text, 'weekly'::text, 'off'::text])))
);

CREATE TABLE public.notifications (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    workspace_id uuid NOT NULL,
    user_id uuid,
    type text NOT NULL,
    severity text DEFAULT 'info'::text NOT NULL,
    resource_type text,
    resource_id uuid,
    title text NOT NULL,
    body text,
    payload jsonb,
    read_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT notifications_severity_check CHECK ((severity = ANY (ARRAY['info'::text, 'warning'::text, 'error'::text, 'success'::text])))
);

CREATE TABLE public.profiles (
    id uuid NOT NULL,
    email text,
    plan text DEFAULT 'free'::text NOT NULL,
    stripe_customer_id text,
    stripe_subscription_id text,
    subscription_status text,
    subscription_current_period_end timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    cancel_at_period_end boolean DEFAULT false NOT NULL,
    payment_method_brand text,
    payment_method_last4 text,
    terms_accepted_at timestamp with time zone,
    CONSTRAINT profiles_plan_check CHECK ((plan = ANY (ARRAY['free'::text, 'pro'::text, 'team'::text])))
);

CREATE TABLE public.rate_limit_counters (
    bucket_key text NOT NULL,
    window_start timestamp with time zone NOT NULL,
    count integer DEFAULT 0 NOT NULL
);

CREATE TABLE public.scans (
    id uuid NOT NULL,
    url text NOT NULL,
    host text GENERATED ALWAYS AS (regexp_replace(lower(substring(url FROM '://([^/?#]+)'::text)), '^www\.'::text, ''::text)) STORED,
    status text DEFAULT 'queued'::text NOT NULL,
    report jsonb,
    error text,
    user_id uuid,
    ip_hash text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    smart_status text DEFAULT 'queued'::text NOT NULL,
    smart_report jsonb,
    smart_error text,
    site_report jsonb,
    smart_site_report jsonb,
    workspace_id uuid,
    website_id uuid,
    created_by uuid,
    source text,
    overall_score integer,
    has_deep boolean DEFAULT false NOT NULL,
    has_smart boolean DEFAULT false NOT NULL,
    CONSTRAINT scans_smart_status_check CHECK ((smart_status = ANY (ARRAY['queued'::text, 'running'::text, 'done'::text, 'unavailable'::text, 'failed'::text, 'disabled'::text]))),
    CONSTRAINT scans_source_check CHECK (((source IS NULL) OR (source = ANY (ARRAY['web'::text, 'cli'::text, 'action'::text, 'cron'::text])))),
    CONSTRAINT scans_status_check CHECK ((status = ANY (ARRAY['queued'::text, 'running'::text, 'done'::text, 'failed'::text])))
);

CREATE TABLE public.stripe_webhook_events (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    stripe_event_id text NOT NULL,
    type text NOT NULL,
    processed_at timestamp with time zone,
    error text,
    created_at timestamp with time zone DEFAULT now()
);

CREATE TABLE public.telemetry_events (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    source text NOT NULL,
    host text,
    score integer,
    deep boolean DEFAULT false NOT NULL,
    smart boolean DEFAULT false NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT telemetry_events_score_check CHECK (((score IS NULL) OR ((score >= 0) AND (score <= 100)))),
    CONSTRAINT telemetry_events_source_check CHECK ((source = ANY (ARRAY['web'::text, 'cli'::text, 'action'::text, 'cron'::text])))
);

CREATE TABLE public.websites (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    workspace_id uuid NOT NULL,
    host text NOT NULL,
    status text DEFAULT 'unverified'::text NOT NULL,
    verification_method text,
    verification_token text,
    verified_at timestamp with time zone,
    badge_enabled boolean DEFAULT false NOT NULL,
    public_report_id uuid,
    monitoring_enabled boolean DEFAULT false NOT NULL,
    created_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    name text,
    CONSTRAINT domains_status_check CHECK ((status = ANY (ARRAY['unverified'::text, 'pending'::text, 'verified'::text])))
);

CREATE TABLE public.workspace_invitations (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    workspace_id uuid NOT NULL,
    email text NOT NULL,
    role text DEFAULT 'member'::text NOT NULL,
    token_hash text NOT NULL,
    invited_by uuid,
    expires_at timestamp with time zone NOT NULL,
    accepted_at timestamp with time zone,
    revoked_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT workspace_invitations_role_check CHECK ((role = ANY (ARRAY['owner'::text, 'admin'::text, 'member'::text, 'viewer'::text, 'billing'::text])))
);

CREATE TABLE public.workspace_members (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    workspace_id uuid NOT NULL,
    user_id uuid NOT NULL,
    role text DEFAULT 'member'::text NOT NULL,
    status text DEFAULT 'active'::text NOT NULL,
    seat_billable boolean DEFAULT true NOT NULL,
    joined_at timestamp with time zone,
    suspended_at timestamp with time zone,
    last_active_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT workspace_members_role_check CHECK ((role = ANY (ARRAY['owner'::text, 'admin'::text, 'member'::text, 'viewer'::text, 'billing'::text]))),
    CONSTRAINT workspace_members_status_check CHECK ((status = ANY (ARRAY['active'::text, 'suspended'::text, 'invited'::text])))
);

CREATE TABLE public.workspaces (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    slug text NOT NULL,
    created_by uuid,
    plan text DEFAULT 'free'::text NOT NULL,
    stripe_customer_id text,
    stripe_subscription_id text,
    subscription_status text,
    subscription_current_period_end timestamp with time zone,
    cancel_at_period_end boolean DEFAULT false NOT NULL,
    seat_limit integer DEFAULT 1 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT workspaces_plan_check CHECK ((plan = ANY (ARRAY['free'::text, 'pro'::text, 'team'::text])))
);

ALTER TABLE ONLY public.ai_usage
    ADD CONSTRAINT ai_usage_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.api_keys
    ADD CONSTRAINT api_keys_key_hash_key UNIQUE (key_hash);

ALTER TABLE ONLY public.api_keys
    ADD CONSTRAINT api_keys_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.audit_events
    ADD CONSTRAINT audit_events_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.chat_threads
    ADD CONSTRAINT chat_threads_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.ci_reports
    ADD CONSTRAINT ci_reports_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.ci_repos
    ADD CONSTRAINT ci_repos_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.ci_repos
    ADD CONSTRAINT ci_repos_repository_id_key UNIQUE (repository_id);

ALTER TABLE ONLY public.ci_repos
    ADD CONSTRAINT ci_repos_slug_key UNIQUE (slug);

ALTER TABLE ONLY public.websites
    ADD CONSTRAINT domains_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.websites
    ADD CONSTRAINT domains_workspace_id_host_key UNIQUE (workspace_id, host);

ALTER TABLE ONLY public.fix_runs
    ADD CONSTRAINT fix_runs_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.leads
    ADD CONSTRAINT leads_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.monitoring_schedules
    ADD CONSTRAINT monitoring_schedules_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.notification_preferences
    ADD CONSTRAINT notification_preferences_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.notification_preferences
    ADD CONSTRAINT notification_preferences_workspace_id_user_id_event_type_key UNIQUE (workspace_id, user_id, event_type);

ALTER TABLE ONLY public.notifications
    ADD CONSTRAINT notifications_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.profiles
    ADD CONSTRAINT profiles_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.rate_limit_counters
    ADD CONSTRAINT rate_limit_counters_pkey PRIMARY KEY (bucket_key, window_start);

ALTER TABLE ONLY public.scans
    ADD CONSTRAINT scans_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.stripe_webhook_events
    ADD CONSTRAINT stripe_webhook_events_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.stripe_webhook_events
    ADD CONSTRAINT stripe_webhook_events_stripe_event_id_key UNIQUE (stripe_event_id);

ALTER TABLE ONLY public.telemetry_events
    ADD CONSTRAINT telemetry_events_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.workspace_invitations
    ADD CONSTRAINT workspace_invitations_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.workspace_invitations
    ADD CONSTRAINT workspace_invitations_token_hash_key UNIQUE (token_hash);

ALTER TABLE ONLY public.workspace_members
    ADD CONSTRAINT workspace_members_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.workspace_members
    ADD CONSTRAINT workspace_members_workspace_id_user_id_key UNIQUE (workspace_id, user_id);

ALTER TABLE ONLY public.workspaces
    ADD CONSTRAINT workspaces_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.workspaces
    ADD CONSTRAINT workspaces_slug_key UNIQUE (slug);

CREATE INDEX ai_usage_api_key_id_idx ON public.ai_usage USING btree (api_key_id);

CREATE UNIQUE INDEX ai_usage_generation_id_key ON public.ai_usage USING btree (generation_id) WHERE (generation_id IS NOT NULL);

CREATE INDEX ai_usage_owner_surface_period_idx ON public.ai_usage USING btree (COALESCE(user_id, api_key_id), surface, period);

CREATE INDEX ai_usage_user_id_idx ON public.ai_usage USING btree (user_id);

CREATE INDEX api_keys_created_by_idx ON public.api_keys USING btree (created_by);

CREATE INDEX api_keys_user_id_idx ON public.api_keys USING btree (user_id);

CREATE INDEX api_keys_workspace_idx ON public.api_keys USING btree (workspace_id);

CREATE INDEX audit_events_actor_user_id_idx ON public.audit_events USING btree (actor_user_id);

CREATE INDEX audit_events_workspace_idx ON public.audit_events USING btree (workspace_id, created_at DESC);

CREATE INDEX chat_threads_scan_id_idx ON public.chat_threads USING btree (scan_id);

CREATE INDEX chat_threads_user_host_idx ON public.chat_threads USING btree (user_id, host);

CREATE INDEX chat_threads_user_id_idx ON public.chat_threads USING btree (user_id);

CREATE UNIQUE INDEX chat_threads_user_scan_key ON public.chat_threads USING btree (user_id, scan_id) WHERE ((website_id IS NULL) AND (scan_id IS NOT NULL));

CREATE INDEX chat_threads_user_website_idx ON public.chat_threads USING btree (user_id, website_id);

CREATE UNIQUE INDEX chat_threads_user_website_key ON public.chat_threads USING btree (user_id, website_id) WHERE (website_id IS NOT NULL);

CREATE INDEX ci_reports_branch_idx ON public.ci_reports USING btree (repo_id, branch, created_at DESC);

CREATE INDEX ci_reports_commit_idx ON public.ci_reports USING btree (repo_id, commit_sha, created_at DESC);

CREATE INDEX ci_reports_scan_id_idx ON public.ci_reports USING btree (scan_id);

CREATE INDEX ci_repos_api_key_id_idx ON public.ci_repos USING btree (api_key_id);

CREATE INDEX ci_repos_user_id_idx ON public.ci_repos USING btree (user_id);

CREATE INDEX domains_workspace_idx ON public.websites USING btree (workspace_id);

CREATE INDEX fix_runs_quota_idx ON public.fix_runs USING btree (api_key_id, created_at DESC);

CREATE INDEX fix_runs_scan_id_idx ON public.fix_runs USING btree (scan_id);

CREATE INDEX fix_runs_workspace_idx ON public.fix_runs USING btree (workspace_id, created_at DESC);

CREATE INDEX leads_created_at_idx ON public.leads USING btree (created_at DESC);

CREATE INDEX leads_email_idx ON public.leads USING btree (email);

CREATE INDEX leads_scan_id_idx ON public.leads USING btree (scan_id);

CREATE INDEX monitoring_schedules_created_by_idx ON public.monitoring_schedules USING btree (created_by);

CREATE INDEX monitoring_schedules_domain_idx ON public.monitoring_schedules USING btree (website_id);

CREATE INDEX monitoring_schedules_next_run_idx ON public.monitoring_schedules USING btree (next_run_at) WHERE (paused_at IS NULL);

CREATE INDEX notification_preferences_user_id_idx ON public.notification_preferences USING btree (user_id);

CREATE INDEX notifications_user_read_idx ON public.notifications USING btree (user_id, read_at);

CREATE INDEX notifications_workspace_user_idx ON public.notifications USING btree (workspace_id, user_id, created_at DESC);

CREATE INDEX profiles_stripe_customer_idx ON public.profiles USING btree (stripe_customer_id) WHERE (stripe_customer_id IS NOT NULL);

CREATE INDEX scans_created_at_idx ON public.scans USING btree (created_at DESC);

CREATE INDEX scans_created_by_idx ON public.scans USING btree (created_by);

CREATE INDEX scans_ip_hash_idx ON public.scans USING btree (ip_hash, created_at DESC) WHERE (ip_hash IS NOT NULL);

CREATE INDEX scans_smart_status_idx ON public.scans USING btree (smart_status, created_at DESC);

CREATE INDEX scans_user_id_idx ON public.scans USING btree (user_id) WHERE (user_id IS NOT NULL);

CREATE INDEX scans_website_id_idx ON public.scans USING btree (website_id);

CREATE INDEX scans_workspace_idx ON public.scans USING btree (workspace_id, created_at DESC);

CREATE INDEX scans_host_idx ON public.scans USING btree (host);

CREATE INDEX telemetry_events_created_at_idx ON public.telemetry_events USING btree (created_at DESC);

CREATE INDEX websites_created_by_idx ON public.websites USING btree (created_by);

CREATE INDEX websites_public_report_id_idx ON public.websites USING btree (public_report_id);

CREATE INDEX workspace_invitations_email_idx ON public.workspace_invitations USING btree (email);

CREATE INDEX workspace_invitations_invited_by_idx ON public.workspace_invitations USING btree (invited_by);

CREATE INDEX workspace_invitations_workspace_idx ON public.workspace_invitations USING btree (workspace_id);

CREATE INDEX workspace_members_user_workspace_idx ON public.workspace_members USING btree (user_id, workspace_id);

CREATE INDEX workspace_members_workspace_idx ON public.workspace_members USING btree (workspace_id);

CREATE INDEX workspaces_created_by_idx ON public.workspaces USING btree (created_by);

CREATE INDEX workspaces_slug_idx ON public.workspaces USING btree (slug);

CREATE INDEX workspaces_stripe_customer_idx ON public.workspaces USING btree (stripe_customer_id) WHERE (stripe_customer_id IS NOT NULL);

ALTER TABLE ONLY public.ai_usage
    ADD CONSTRAINT ai_usage_api_key_id_fkey FOREIGN KEY (api_key_id) REFERENCES public.api_keys(id) ON DELETE SET NULL;

ALTER TABLE ONLY public.ai_usage
    ADD CONSTRAINT ai_usage_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.api_keys
    ADD CONSTRAINT api_keys_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE SET NULL;

ALTER TABLE ONLY public.api_keys
    ADD CONSTRAINT api_keys_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.api_keys
    ADD CONSTRAINT api_keys_workspace_id_fkey FOREIGN KEY (workspace_id) REFERENCES public.workspaces(id) ON DELETE SET NULL;

ALTER TABLE ONLY public.audit_events
    ADD CONSTRAINT audit_events_actor_user_id_fkey FOREIGN KEY (actor_user_id) REFERENCES auth.users(id) ON DELETE SET NULL;

ALTER TABLE ONLY public.audit_events
    ADD CONSTRAINT audit_events_workspace_id_fkey FOREIGN KEY (workspace_id) REFERENCES public.workspaces(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.chat_threads
    ADD CONSTRAINT chat_threads_scan_id_fkey FOREIGN KEY (scan_id) REFERENCES public.scans(id) ON DELETE SET NULL;

ALTER TABLE ONLY public.chat_threads
    ADD CONSTRAINT chat_threads_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.chat_threads
    ADD CONSTRAINT chat_threads_website_id_fkey FOREIGN KEY (website_id) REFERENCES public.websites(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.ci_reports
    ADD CONSTRAINT ci_reports_repo_id_fkey FOREIGN KEY (repo_id) REFERENCES public.ci_repos(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.ci_reports
    ADD CONSTRAINT ci_reports_scan_id_fkey FOREIGN KEY (scan_id) REFERENCES public.scans(id) ON DELETE SET NULL;

ALTER TABLE ONLY public.ci_repos
    ADD CONSTRAINT ci_repos_api_key_id_fkey FOREIGN KEY (api_key_id) REFERENCES public.api_keys(id) ON DELETE SET NULL;

ALTER TABLE ONLY public.ci_repos
    ADD CONSTRAINT ci_repos_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.websites
    ADD CONSTRAINT domains_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE SET NULL;

ALTER TABLE ONLY public.websites
    ADD CONSTRAINT domains_public_report_id_fkey FOREIGN KEY (public_report_id) REFERENCES public.scans(id) ON DELETE SET NULL;

ALTER TABLE ONLY public.websites
    ADD CONSTRAINT domains_workspace_id_fkey FOREIGN KEY (workspace_id) REFERENCES public.workspaces(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.fix_runs
    ADD CONSTRAINT fix_runs_api_key_id_fkey FOREIGN KEY (api_key_id) REFERENCES public.api_keys(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.fix_runs
    ADD CONSTRAINT fix_runs_scan_id_fkey FOREIGN KEY (scan_id) REFERENCES public.scans(id) ON DELETE SET NULL;

ALTER TABLE ONLY public.fix_runs
    ADD CONSTRAINT fix_runs_workspace_id_fkey FOREIGN KEY (workspace_id) REFERENCES public.workspaces(id) ON DELETE SET NULL;

ALTER TABLE ONLY public.leads
    ADD CONSTRAINT leads_scan_id_fkey FOREIGN KEY (scan_id) REFERENCES public.scans(id) ON DELETE SET NULL;

ALTER TABLE ONLY public.monitoring_schedules
    ADD CONSTRAINT monitoring_schedules_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE SET NULL;

ALTER TABLE ONLY public.monitoring_schedules
    ADD CONSTRAINT monitoring_schedules_website_id_fkey FOREIGN KEY (website_id) REFERENCES public.websites(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.notification_preferences
    ADD CONSTRAINT notification_preferences_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.notification_preferences
    ADD CONSTRAINT notification_preferences_workspace_id_fkey FOREIGN KEY (workspace_id) REFERENCES public.workspaces(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.notifications
    ADD CONSTRAINT notifications_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.notifications
    ADD CONSTRAINT notifications_workspace_id_fkey FOREIGN KEY (workspace_id) REFERENCES public.workspaces(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.profiles
    ADD CONSTRAINT profiles_id_fkey FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.scans
    ADD CONSTRAINT scans_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE SET NULL;

ALTER TABLE ONLY public.scans
    ADD CONSTRAINT scans_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE SET NULL;

ALTER TABLE ONLY public.scans
    ADD CONSTRAINT scans_website_id_fkey FOREIGN KEY (website_id) REFERENCES public.websites(id) ON DELETE SET NULL;

ALTER TABLE ONLY public.scans
    ADD CONSTRAINT scans_workspace_id_fkey FOREIGN KEY (workspace_id) REFERENCES public.workspaces(id) ON DELETE SET NULL;

ALTER TABLE ONLY public.workspace_invitations
    ADD CONSTRAINT workspace_invitations_invited_by_fkey FOREIGN KEY (invited_by) REFERENCES auth.users(id) ON DELETE SET NULL;

ALTER TABLE ONLY public.workspace_invitations
    ADD CONSTRAINT workspace_invitations_workspace_id_fkey FOREIGN KEY (workspace_id) REFERENCES public.workspaces(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.workspace_members
    ADD CONSTRAINT workspace_members_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.workspace_members
    ADD CONSTRAINT workspace_members_workspace_id_fkey FOREIGN KEY (workspace_id) REFERENCES public.workspaces(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.workspaces
    ADD CONSTRAINT workspaces_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE SET NULL;

CREATE POLICY "Members can read audit events of their workspaces" ON public.audit_events FOR SELECT TO authenticated USING (public.is_active_workspace_member(workspace_id));

CREATE POLICY "Members can read domains of their workspaces" ON public.websites FOR SELECT TO authenticated USING (public.is_active_workspace_member(workspace_id));

CREATE POLICY "Members can read invitations of their workspaces" ON public.workspace_invitations FOR SELECT TO authenticated USING (public.is_active_workspace_member(workspace_id));

CREATE POLICY "Members can read membership of their workspaces" ON public.workspace_members FOR SELECT TO authenticated USING (public.is_active_workspace_member(workspace_id));

CREATE POLICY "Members can read monitoring schedules of their workspaces" ON public.monitoring_schedules FOR SELECT TO authenticated USING ((website_id IN ( SELECT d.id
   FROM public.websites d
  WHERE public.is_active_workspace_member(d.workspace_id))));

CREATE POLICY "Members can read their notifications" ON public.notifications FOR SELECT TO authenticated USING (((user_id = ( SELECT auth.uid() AS uid)) OR ((user_id IS NULL) AND public.is_active_workspace_member(workspace_id))));

CREATE POLICY "Members can read their workspaces" ON public.workspaces FOR SELECT TO authenticated USING (public.is_active_workspace_member(id));

CREATE POLICY "Users can read their own ai usage" ON public.ai_usage FOR SELECT TO authenticated USING ((user_id = ( SELECT auth.uid() AS uid)));

CREATE POLICY "Users can read their own api keys" ON public.api_keys FOR SELECT TO authenticated USING ((user_id = ( SELECT auth.uid() AS uid)));

CREATE POLICY "Users can read their own chat threads" ON public.chat_threads FOR SELECT TO authenticated USING ((user_id = ( SELECT auth.uid() AS uid)));

CREATE POLICY "Users can read their own ci reports" ON public.ci_reports FOR SELECT TO authenticated USING ((repo_id IN ( SELECT ci_repos.id
   FROM public.ci_repos
  WHERE (ci_repos.user_id = ( SELECT auth.uid() AS uid)))));

CREATE POLICY "Users can read their own ci repos" ON public.ci_repos FOR SELECT TO authenticated USING ((user_id = ( SELECT auth.uid() AS uid)));

CREATE POLICY "Users can read their own fix runs" ON public.fix_runs FOR SELECT TO authenticated USING ((api_key_id IN ( SELECT api_keys.id
   FROM public.api_keys
  WHERE (api_keys.user_id = ( SELECT auth.uid() AS uid)))));

CREATE POLICY "Users can read their own notification preferences" ON public.notification_preferences FOR SELECT TO authenticated USING ((user_id = ( SELECT auth.uid() AS uid)));

CREATE POLICY "Users can read their own profile" ON public.profiles FOR SELECT TO authenticated USING ((( SELECT auth.uid() AS uid) = id));

CREATE POLICY "Users can read their own scans" ON public.scans FOR SELECT TO authenticated USING ((user_id = ( SELECT auth.uid() AS uid)));

CREATE POLICY "Workspace members can read workspace api keys" ON public.api_keys FOR SELECT TO authenticated USING (public.is_active_workspace_member(workspace_id));

CREATE POLICY "Workspace members can read workspace scans" ON public.scans FOR SELECT TO authenticated USING (public.is_active_workspace_member(workspace_id));

ALTER TABLE public.ai_usage ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.api_keys ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.audit_events ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.chat_threads ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.ci_reports ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.ci_repos ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.fix_runs ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.monitoring_schedules ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.notification_preferences ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.rate_limit_counters ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.scans ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.stripe_webhook_events ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.telemetry_events ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.websites ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.workspace_invitations ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.workspace_members ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.workspaces ENABLE ROW LEVEL SECURITY;

GRANT USAGE ON SCHEMA public TO postgres;
GRANT USAGE ON SCHEMA public TO anon;
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT USAGE ON SCHEMA public TO service_role;

REVOKE ALL ON FUNCTION public.ai_usage_this_month(p_surface text, p_owner uuid, p_period text) FROM PUBLIC;
GRANT ALL ON FUNCTION public.ai_usage_this_month(p_surface text, p_owner uuid, p_period text) TO service_role;

GRANT ALL ON FUNCTION public.consume_metered_run(p_api_key_id uuid, p_kind text, p_repo text, p_url text, p_patches integer, p_window_ms bigint, p_limit integer) TO anon;
GRANT ALL ON FUNCTION public.consume_metered_run(p_api_key_id uuid, p_kind text, p_repo text, p_url text, p_patches integer, p_window_ms bigint, p_limit integer) TO authenticated;
GRANT ALL ON FUNCTION public.consume_metered_run(p_api_key_id uuid, p_kind text, p_repo text, p_url text, p_patches integer, p_window_ms bigint, p_limit integer) TO service_role;

GRANT ALL ON FUNCTION public.consume_rate_limit(p_key text, p_window_ms bigint, p_limit integer) TO anon;
GRANT ALL ON FUNCTION public.consume_rate_limit(p_key text, p_window_ms bigint, p_limit integer) TO authenticated;
GRANT ALL ON FUNCTION public.consume_rate_limit(p_key text, p_window_ms bigint, p_limit integer) TO service_role;

REVOKE ALL ON FUNCTION public.delete_stale_anonymous_users(p_retention_days integer) FROM PUBLIC;
GRANT ALL ON FUNCTION public.delete_stale_anonymous_users(p_retention_days integer) TO service_role;

GRANT ALL ON FUNCTION public.handle_new_user() TO anon;
GRANT ALL ON FUNCTION public.handle_new_user() TO authenticated;
GRANT ALL ON FUNCTION public.handle_new_user() TO service_role;

GRANT ALL ON FUNCTION public.is_active_workspace_member(ws uuid) TO anon;
GRANT ALL ON FUNCTION public.is_active_workspace_member(ws uuid) TO authenticated;
GRANT ALL ON FUNCTION public.is_active_workspace_member(ws uuid) TO service_role;

REVOKE ALL ON FUNCTION public.record_ai_usage(p_surface text, p_period text, p_user_id uuid, p_api_key_id uuid, p_generation_id text, p_messages integer, p_tokens bigint) FROM PUBLIC;
GRANT ALL ON FUNCTION public.record_ai_usage(p_surface text, p_period text, p_user_id uuid, p_api_key_id uuid, p_generation_id text, p_messages integer, p_tokens bigint) TO service_role;

GRANT ALL ON TABLE public.ai_usage TO anon;
GRANT ALL ON TABLE public.ai_usage TO authenticated;
GRANT ALL ON TABLE public.ai_usage TO service_role;

GRANT ALL ON TABLE public.api_keys TO anon;
GRANT INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,MAINTAIN,UPDATE ON TABLE public.api_keys TO authenticated;
GRANT ALL ON TABLE public.api_keys TO service_role;

GRANT SELECT(id) ON TABLE public.api_keys TO authenticated;

GRANT SELECT(label) ON TABLE public.api_keys TO authenticated;

GRANT SELECT(user_id) ON TABLE public.api_keys TO authenticated;

GRANT SELECT(plan) ON TABLE public.api_keys TO authenticated;

GRANT SELECT(created_at) ON TABLE public.api_keys TO authenticated;

GRANT SELECT(revoked_at) ON TABLE public.api_keys TO authenticated;

GRANT SELECT(badge_domains) ON TABLE public.api_keys TO authenticated;

GRANT SELECT(workspace_id) ON TABLE public.api_keys TO authenticated;

GRANT SELECT(created_by) ON TABLE public.api_keys TO authenticated;

GRANT SELECT(prefix) ON TABLE public.api_keys TO authenticated;

GRANT SELECT(scopes) ON TABLE public.api_keys TO authenticated;

GRANT SELECT(expires_at) ON TABLE public.api_keys TO authenticated;

GRANT SELECT(last_used_at) ON TABLE public.api_keys TO authenticated;

GRANT ALL ON TABLE public.audit_events TO anon;
GRANT ALL ON TABLE public.audit_events TO authenticated;
GRANT ALL ON TABLE public.audit_events TO service_role;

GRANT ALL ON TABLE public.chat_threads TO anon;
GRANT ALL ON TABLE public.chat_threads TO authenticated;
GRANT ALL ON TABLE public.chat_threads TO service_role;

GRANT ALL ON TABLE public.ci_reports TO anon;
GRANT ALL ON TABLE public.ci_reports TO authenticated;
GRANT ALL ON TABLE public.ci_reports TO service_role;

GRANT ALL ON TABLE public.ci_repos TO anon;
GRANT ALL ON TABLE public.ci_repos TO authenticated;
GRANT ALL ON TABLE public.ci_repos TO service_role;

GRANT ALL ON TABLE public.fix_runs TO anon;
GRANT ALL ON TABLE public.fix_runs TO authenticated;
GRANT ALL ON TABLE public.fix_runs TO service_role;

GRANT ALL ON TABLE public.leads TO anon;
GRANT ALL ON TABLE public.leads TO authenticated;
GRANT ALL ON TABLE public.leads TO service_role;

GRANT ALL ON TABLE public.monitoring_schedules TO anon;
GRANT ALL ON TABLE public.monitoring_schedules TO authenticated;
GRANT ALL ON TABLE public.monitoring_schedules TO service_role;

GRANT ALL ON TABLE public.notification_preferences TO anon;
GRANT ALL ON TABLE public.notification_preferences TO authenticated;
GRANT ALL ON TABLE public.notification_preferences TO service_role;

GRANT ALL ON TABLE public.notifications TO anon;
GRANT ALL ON TABLE public.notifications TO authenticated;
GRANT ALL ON TABLE public.notifications TO service_role;

GRANT ALL ON TABLE public.profiles TO anon;
GRANT ALL ON TABLE public.profiles TO authenticated;
GRANT ALL ON TABLE public.profiles TO service_role;

GRANT ALL ON TABLE public.rate_limit_counters TO service_role;

GRANT ALL ON TABLE public.scans TO anon;
GRANT ALL ON TABLE public.scans TO authenticated;
GRANT ALL ON TABLE public.scans TO service_role;

GRANT ALL ON TABLE public.stripe_webhook_events TO anon;
GRANT ALL ON TABLE public.stripe_webhook_events TO authenticated;
GRANT ALL ON TABLE public.stripe_webhook_events TO service_role;

GRANT ALL ON TABLE public.telemetry_events TO anon;
GRANT ALL ON TABLE public.telemetry_events TO authenticated;
GRANT ALL ON TABLE public.telemetry_events TO service_role;

GRANT ALL ON TABLE public.websites TO anon;
GRANT ALL ON TABLE public.websites TO authenticated;
GRANT ALL ON TABLE public.websites TO service_role;

GRANT ALL ON TABLE public.workspace_invitations TO anon;
GRANT INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,MAINTAIN,UPDATE ON TABLE public.workspace_invitations TO authenticated;
GRANT ALL ON TABLE public.workspace_invitations TO service_role;

GRANT SELECT(id) ON TABLE public.workspace_invitations TO authenticated;

GRANT SELECT(workspace_id) ON TABLE public.workspace_invitations TO authenticated;

GRANT SELECT(email) ON TABLE public.workspace_invitations TO authenticated;

GRANT SELECT(role) ON TABLE public.workspace_invitations TO authenticated;

GRANT SELECT(invited_by) ON TABLE public.workspace_invitations TO authenticated;

GRANT SELECT(expires_at) ON TABLE public.workspace_invitations TO authenticated;

GRANT SELECT(accepted_at) ON TABLE public.workspace_invitations TO authenticated;

GRANT SELECT(revoked_at) ON TABLE public.workspace_invitations TO authenticated;

GRANT SELECT(created_at) ON TABLE public.workspace_invitations TO authenticated;

GRANT ALL ON TABLE public.workspace_members TO anon;
GRANT ALL ON TABLE public.workspace_members TO authenticated;
GRANT ALL ON TABLE public.workspace_members TO service_role;

GRANT ALL ON TABLE public.workspaces TO anon;
GRANT INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,MAINTAIN,UPDATE ON TABLE public.workspaces TO authenticated;
GRANT ALL ON TABLE public.workspaces TO service_role;

GRANT SELECT(id) ON TABLE public.workspaces TO authenticated;

GRANT SELECT(name) ON TABLE public.workspaces TO authenticated;

GRANT SELECT(slug) ON TABLE public.workspaces TO authenticated;

GRANT SELECT(created_by) ON TABLE public.workspaces TO authenticated;

GRANT SELECT(plan) ON TABLE public.workspaces TO authenticated;

GRANT SELECT(seat_limit) ON TABLE public.workspaces TO authenticated;

GRANT SELECT(created_at) ON TABLE public.workspaces TO authenticated;

-- Materialize a profile row on signup.
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- Stripe-owned billing columns on profiles can't be changed by a user session.
create trigger guard_profile_billing
  before update on public.profiles
  for each row execute procedure public.guard_profile_billing();

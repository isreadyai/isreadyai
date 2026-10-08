CREATE TABLE "public"."scans" (
  "id"                uuid                     NOT NULL,
  "url"               text                     NOT NULL,
  "status"            text                     NOT NULL DEFAULT 'queued'::text,
  "report"            jsonb,
  "error"             text,
  "user_id"           uuid,
  "ip_hash"           text,
  "created_at"        timestamp with time zone NOT NULL DEFAULT now(),
  "smart_status"      text                     NOT NULL DEFAULT 'queued'::text,
  "smart_report"      jsonb,
  "smart_error"       text,
  "site_report"       jsonb,
  "smart_site_report" jsonb,
  "workspace_id"      uuid,
  "website_id"        uuid,
  "created_by"        uuid,
  "source"            text,
  "overall_score"     integer,
  "has_deep"          boolean                  NOT NULL DEFAULT false,
  "has_smart"         boolean                  NOT NULL DEFAULT false,
  CONSTRAINT "scans_created_by_fkey" FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE SET NULL,
  CONSTRAINT "scans_pkey" PRIMARY KEY (id),
  CONSTRAINT "scans_smart_status_check" CHECK ((smart_status = ANY (ARRAY['queued'::text, 'running'::text, 'done'::text, 'unavailable'::text, 'failed'::text, 'disabled'::text]))),
  CONSTRAINT "scans_source_check" CHECK (((source IS NULL) OR (source = ANY (ARRAY['web'::text, 'cli'::text, 'action'::text, 'cron'::text])))),
  CONSTRAINT "scans_status_check" CHECK ((status = ANY (ARRAY['queued'::text, 'running'::text, 'done'::text, 'failed'::text]))),
  CONSTRAINT "scans_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE SET NULL,
  CONSTRAINT "scans_workspace_id_fkey" FOREIGN KEY (workspace_id) REFERENCES public.workspaces(id) ON DELETE SET NULL
);

ALTER TABLE "public"."scans"
  ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."scans"
  ADD COLUMN "host" text GENERATED ALWAYS AS (regexp_replace(lower("substring"(url, '://([^/?#]+)'::text)), '^www\.'::text, ''::text)) STORED;

CREATE INDEX scans_created_at_idx ON public.scans USING btree (created_at DESC);

CREATE INDEX scans_created_by_idx ON public.scans USING btree (created_by);

CREATE INDEX scans_host_idx ON public.scans USING btree (host);

CREATE INDEX scans_ip_hash_idx ON public.scans USING btree (ip_hash, created_at DESC)
  WHERE (ip_hash IS NOT NULL);

CREATE INDEX scans_smart_status_idx ON public.scans USING btree (smart_status, created_at DESC);

CREATE INDEX scans_user_id_idx ON public.scans USING btree (user_id)
  WHERE (user_id IS NOT NULL);

CREATE INDEX scans_website_id_idx ON public.scans USING btree (website_id);

CREATE INDEX scans_workspace_idx ON public.scans USING btree (workspace_id, created_at DESC);

CREATE POLICY "Users can read their own scans" ON "public"."scans"
  FOR SELECT
  TO "authenticated"
  USING ((user_id = ( SELECT auth.uid() AS uid)));

CREATE POLICY "Workspace members can read workspace scans" ON "public"."scans"
  FOR SELECT
  TO "authenticated"
  USING (public.is_active_workspace_member(workspace_id));

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."scans" TO "anon", "authenticated", "service_role";

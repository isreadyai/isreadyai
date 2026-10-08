CREATE TABLE "public"."fix_runs" (
  "id"           uuid                     NOT NULL DEFAULT gen_random_uuid(),
  "api_key_id"   uuid                     NOT NULL,
  "repo"         text                     NOT NULL,
  "url"          text                     NOT NULL,
  "scan_id"      uuid,
  "patches"      integer                  NOT NULL DEFAULT 0,
  "created_at"   timestamp with time zone NOT NULL DEFAULT now(),
  "workspace_id" uuid,
  "kind"         text,
  CONSTRAINT "fix_runs_api_key_id_fkey" FOREIGN KEY (api_key_id) REFERENCES public.api_keys(id) ON DELETE CASCADE,
  CONSTRAINT "fix_runs_kind_check" CHECK (((kind IS NULL) OR (kind = ANY (ARRAY['fix'::text, 'solve'::text, 'plan'::text])))),
  CONSTRAINT "fix_runs_pkey" PRIMARY KEY (id),
  CONSTRAINT "fix_runs_scan_id_fkey" FOREIGN KEY (scan_id) REFERENCES public.scans(id) ON DELETE SET NULL,
  CONSTRAINT "fix_runs_workspace_id_fkey" FOREIGN KEY (workspace_id) REFERENCES public.workspaces(id) ON DELETE SET NULL
);

ALTER TABLE "public"."fix_runs"
  ENABLE ROW LEVEL SECURITY;

CREATE INDEX fix_runs_quota_idx ON public.fix_runs USING btree (api_key_id, created_at DESC);

CREATE INDEX fix_runs_scan_id_idx ON public.fix_runs USING btree (scan_id);

CREATE INDEX fix_runs_workspace_idx ON public.fix_runs USING btree (workspace_id, created_at DESC);

CREATE POLICY "Users can read their own fix runs" ON "public"."fix_runs"
  FOR SELECT
  TO "authenticated"
  USING ((api_key_id IN ( SELECT api_keys.id
   FROM public.api_keys
  WHERE (api_keys.user_id = ( SELECT auth.uid() AS uid)))));

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."fix_runs" TO "anon", "authenticated", "service_role";

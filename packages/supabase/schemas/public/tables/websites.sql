CREATE TABLE "public"."websites" (
  "id"                  uuid                     NOT NULL DEFAULT gen_random_uuid(),
  "workspace_id"        uuid                     NOT NULL,
  "host"                text                     NOT NULL,
  "status"              text                     NOT NULL DEFAULT 'unverified'::text,
  "verification_method" text,
  "verification_token"  text,
  "verified_at"         timestamp with time zone,
  "badge_enabled"       boolean                  NOT NULL DEFAULT false,
  "public_report_id"    uuid,
  "monitoring_enabled"  boolean                  NOT NULL DEFAULT false,
  "created_by"          uuid,
  "created_at"          timestamp with time zone NOT NULL DEFAULT now(),
  "name"                text,
  CONSTRAINT "domains_created_by_fkey" FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE SET NULL,
  CONSTRAINT "domains_pkey" PRIMARY KEY (id),
  CONSTRAINT "domains_status_check" CHECK ((status = ANY (ARRAY['unverified'::text, 'pending'::text, 'verified'::text]))),
  CONSTRAINT "domains_workspace_id_host_key" UNIQUE (workspace_id, host),
  CONSTRAINT "domains_workspace_id_fkey" FOREIGN KEY (workspace_id) REFERENCES public.workspaces(id) ON DELETE CASCADE
);

ALTER TABLE "public"."websites"
  ENABLE ROW LEVEL SECURITY;

CREATE INDEX domains_workspace_idx ON public.websites USING btree (workspace_id);

CREATE INDEX websites_created_by_idx ON public.websites USING btree (created_by);

CREATE INDEX websites_public_report_id_idx ON public.websites USING btree (public_report_id);

CREATE POLICY "Members can read domains of their workspaces" ON "public"."websites"
  FOR SELECT
  TO "authenticated"
  USING (public.is_active_workspace_member(workspace_id));

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."websites" TO "anon", "authenticated", "service_role";

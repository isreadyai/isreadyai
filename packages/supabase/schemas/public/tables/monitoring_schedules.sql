CREATE TABLE "public"."monitoring_schedules" (
  "id"                    uuid                     NOT NULL DEFAULT gen_random_uuid(),
  "website_id"            uuid                     NOT NULL,
  "frequency"             text                     NOT NULL DEFAULT 'weekly'::text,
  "timezone"              text                     NOT NULL DEFAULT 'UTC'::text,
  "next_run_at"           timestamp with time zone,
  "alert_threshold"       integer,
  "alert_delta"           integer,
  "paused_at"             timestamp with time zone,
  "created_by"            uuid,
  "created_at"            timestamp with time zone NOT NULL DEFAULT now(),
  "scan_mode"             text                     NOT NULL DEFAULT 'simple'::text,
  "smart_agent_enabled"   boolean                  NOT NULL DEFAULT true,
  "last_weekly_report_at" timestamp with time zone,
  CONSTRAINT "monitoring_schedules_created_by_fkey" FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE SET NULL,
  CONSTRAINT "monitoring_schedules_frequency_check" CHECK ((frequency = ANY (ARRAY['hourly'::text, 'daily'::text, 'weekly'::text]))),
  CONSTRAINT "monitoring_schedules_pkey" PRIMARY KEY (id),
  CONSTRAINT "monitoring_schedules_scan_mode_check" CHECK ((scan_mode = ANY (ARRAY['simple'::text, 'deep'::text]))),
  CONSTRAINT "monitoring_schedules_website_id_fkey" FOREIGN KEY (website_id) REFERENCES public.websites(id) ON DELETE CASCADE
);

ALTER TABLE "public"."monitoring_schedules"
  ENABLE ROW LEVEL SECURITY;

CREATE INDEX monitoring_schedules_created_by_idx ON public.monitoring_schedules USING btree (created_by);

CREATE INDEX monitoring_schedules_domain_idx ON public.monitoring_schedules USING btree (website_id);

CREATE INDEX monitoring_schedules_next_run_idx ON public.monitoring_schedules USING btree (next_run_at)
  WHERE (paused_at IS NULL);

CREATE POLICY "Members can read monitoring schedules of their workspaces" ON "public"."monitoring_schedules"
  FOR SELECT
  TO "authenticated"
  USING ((website_id IN ( SELECT d.id
   FROM public.websites d
  WHERE public.is_active_workspace_member(d.workspace_id))));

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."monitoring_schedules" TO "anon", "authenticated", "service_role";

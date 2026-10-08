CREATE TABLE "public"."telemetry_events" (
  "id"         uuid                     NOT NULL DEFAULT gen_random_uuid(),
  "source"     text                     NOT NULL,
  "host"       text,
  "score"      integer,
  "deep"       boolean                  NOT NULL DEFAULT false,
  "smart"      boolean                  NOT NULL DEFAULT false,
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT "telemetry_events_pkey" PRIMARY KEY (id),
  CONSTRAINT "telemetry_events_score_check" CHECK (((score IS NULL) OR ((score >= 0) AND (score <= 100)))),
  CONSTRAINT "telemetry_events_source_check" CHECK ((source = ANY (ARRAY['web'::text, 'cli'::text, 'action'::text, 'cron'::text])))
);

ALTER TABLE "public"."telemetry_events"
  ENABLE ROW LEVEL SECURITY;

CREATE INDEX telemetry_events_created_at_idx ON public.telemetry_events USING btree (created_at DESC);

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."telemetry_events" TO "anon", "authenticated", "service_role";

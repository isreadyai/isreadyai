CREATE TABLE "public"."stripe_webhook_events" (
  "id"              uuid                     NOT NULL DEFAULT gen_random_uuid(),
  "stripe_event_id" text                     NOT NULL,
  "type"            text                     NOT NULL,
  "processed_at"    timestamp with time zone,
  "error"           text,
  "created_at"      timestamp with time zone DEFAULT now(),
  CONSTRAINT "stripe_webhook_events_pkey" PRIMARY KEY (id),
  CONSTRAINT "stripe_webhook_events_stripe_event_id_key" UNIQUE (stripe_event_id)
);

ALTER TABLE "public"."stripe_webhook_events"
  ENABLE ROW LEVEL SECURITY;

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."stripe_webhook_events" TO "anon", "authenticated", "service_role";

CREATE TABLE "public"."rate_limit_counters" (
  "bucket_key"   text                     NOT NULL,
  "window_start" timestamp with time zone NOT NULL,
  "count"        integer                  NOT NULL DEFAULT 0,
  CONSTRAINT "rate_limit_counters_pkey" PRIMARY KEY (bucket_key, window_start)
);

ALTER TABLE "public"."rate_limit_counters"
  ENABLE ROW LEVEL SECURITY;

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."rate_limit_counters" TO "service_role";

REVOKE ALL ON TABLE "public"."rate_limit_counters" FROM "anon", "authenticated";

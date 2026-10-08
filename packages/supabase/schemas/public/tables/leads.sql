CREATE TABLE "public"."leads" (
  "id"         uuid                     NOT NULL DEFAULT gen_random_uuid(),
  "email"      text                     NOT NULL,
  "scan_id"    uuid,
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT "leads_pkey" PRIMARY KEY (id),
  CONSTRAINT "leads_scan_id_fkey" FOREIGN KEY (scan_id) REFERENCES public.scans(id) ON DELETE SET NULL
);

ALTER TABLE "public"."leads"
  ENABLE ROW LEVEL SECURITY;

CREATE INDEX leads_created_at_idx ON public.leads USING btree (created_at DESC);

CREATE INDEX leads_email_idx ON public.leads USING btree (email);

CREATE INDEX leads_scan_id_idx ON public.leads USING btree (scan_id);

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."leads" TO "anon", "authenticated", "service_role";

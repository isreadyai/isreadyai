CREATE TABLE "public"."workspaces" (
  "id"                              uuid                     NOT NULL DEFAULT gen_random_uuid(),
  "name"                            text                     NOT NULL,
  "slug"                            text                     NOT NULL,
  "created_by"                      uuid,
  "plan"                            text                     NOT NULL DEFAULT 'free'::text,
  "stripe_customer_id"              text,
  "stripe_subscription_id"          text,
  "subscription_status"             text,
  "subscription_current_period_end" timestamp with time zone,
  "cancel_at_period_end"            boolean                  NOT NULL DEFAULT false,
  "seat_limit"                      integer                  NOT NULL DEFAULT 1,
  "created_at"                      timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT "workspaces_created_by_fkey" FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE SET NULL,
  CONSTRAINT "workspaces_pkey" PRIMARY KEY (id),
  CONSTRAINT "workspaces_plan_check" CHECK ((plan = ANY (ARRAY['free'::text, 'pro'::text, 'team'::text]))),
  CONSTRAINT "workspaces_slug_key" UNIQUE (slug)
);

ALTER TABLE "public"."workspaces"
  ENABLE ROW LEVEL SECURITY;

CREATE INDEX workspaces_created_by_idx ON public.workspaces USING btree (created_by);

CREATE INDEX workspaces_slug_idx ON public.workspaces USING btree (slug);

CREATE INDEX workspaces_stripe_customer_idx ON public.workspaces USING btree (stripe_customer_id)
  WHERE (stripe_customer_id IS NOT NULL);

CREATE POLICY "Members can read their workspaces" ON "public"."workspaces"
  FOR SELECT
  TO "authenticated"
  USING (public.is_active_workspace_member(id));

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."workspaces" TO "anon";

REVOKE ALL ON TABLE "public"."workspaces" FROM "authenticated";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."workspaces" TO "service_role";

REVOKE ALL ("created_at") ON TABLE "public"."workspaces" FROM "authenticated";

GRANT SELECT ("created_at") ON TABLE "public"."workspaces" TO "authenticated";

REVOKE ALL ("created_by") ON TABLE "public"."workspaces" FROM "authenticated";

GRANT SELECT ("created_by") ON TABLE "public"."workspaces" TO "authenticated";

REVOKE ALL ("id") ON TABLE "public"."workspaces" FROM "authenticated";

GRANT SELECT ("id") ON TABLE "public"."workspaces" TO "authenticated";

REVOKE ALL ("name") ON TABLE "public"."workspaces" FROM "authenticated";

GRANT SELECT ("name") ON TABLE "public"."workspaces" TO "authenticated";

REVOKE ALL ("plan") ON TABLE "public"."workspaces" FROM "authenticated";

GRANT SELECT ("plan") ON TABLE "public"."workspaces" TO "authenticated";

REVOKE ALL ("seat_limit") ON TABLE "public"."workspaces" FROM "authenticated";

GRANT SELECT ("seat_limit") ON TABLE "public"."workspaces" TO "authenticated";

REVOKE ALL ("slug") ON TABLE "public"."workspaces" FROM "authenticated";

GRANT SELECT ("slug") ON TABLE "public"."workspaces" TO "authenticated";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."workspaces" TO "authenticated";

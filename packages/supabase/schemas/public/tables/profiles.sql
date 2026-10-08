CREATE TABLE "public"."profiles" (
  "id"                              uuid                     NOT NULL,
  "email"                           text,
  "plan"                            text                     NOT NULL DEFAULT 'free'::text,
  "stripe_customer_id"              text,
  "stripe_subscription_id"          text,
  "subscription_status"             text,
  "subscription_current_period_end" timestamp with time zone,
  "created_at"                      timestamp with time zone NOT NULL DEFAULT now(),
  "cancel_at_period_end"            boolean                  NOT NULL DEFAULT false,
  "payment_method_brand"            text,
  "payment_method_last4"            text,
  "terms_accepted_at"               timestamp with time zone,
  CONSTRAINT "profiles_id_fkey" FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE,
  CONSTRAINT "profiles_pkey" PRIMARY KEY (id),
  CONSTRAINT "profiles_plan_check" CHECK ((plan = ANY (ARRAY['free'::text, 'pro'::text, 'team'::text])))
);

ALTER TABLE "public"."profiles"
  ENABLE ROW LEVEL SECURITY;

CREATE INDEX profiles_stripe_customer_idx ON public.profiles USING btree (stripe_customer_id)
  WHERE (stripe_customer_id IS NOT NULL);

CREATE TRIGGER guard_profile_billing
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.guard_profile_billing();

CREATE POLICY "Users can read their own profile" ON "public"."profiles"
  FOR SELECT
  TO "authenticated"
  USING ((( SELECT auth.uid() AS uid) = id));

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."profiles" TO "anon", "authenticated", "service_role";

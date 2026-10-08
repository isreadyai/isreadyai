CREATE TABLE "public"."api_keys" (
  "id"            uuid                     NOT NULL DEFAULT gen_random_uuid(),
  "key_hash"      text                     NOT NULL,
  "label"         text,
  "user_id"       uuid,
  "plan"          text                     NOT NULL DEFAULT 'free'::text,
  "created_at"    timestamp with time zone NOT NULL DEFAULT now(),
  "revoked_at"    timestamp with time zone,
  "badge_domains" text[]                   NOT NULL DEFAULT '{}'::text[],
  "workspace_id"  uuid,
  "created_by"    uuid,
  "prefix"        text,
  "scopes"        text[]                   NOT NULL DEFAULT '{}'::text[],
  "expires_at"    timestamp with time zone,
  "last_used_at"  timestamp with time zone,
  CONSTRAINT "api_keys_created_by_fkey" FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE SET NULL,
  CONSTRAINT "api_keys_key_hash_key" UNIQUE (key_hash),
  CONSTRAINT "api_keys_pkey" PRIMARY KEY (id),
  CONSTRAINT "api_keys_plan_check" CHECK ((plan = ANY (ARRAY['free'::text, 'pro'::text, 'team'::text]))),
  CONSTRAINT "api_keys_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE,
  CONSTRAINT "api_keys_workspace_id_fkey" FOREIGN KEY (workspace_id) REFERENCES public.workspaces(id) ON DELETE SET NULL
);

ALTER TABLE "public"."api_keys"
  ENABLE ROW LEVEL SECURITY;

CREATE INDEX api_keys_created_by_idx ON public.api_keys USING btree (created_by);

CREATE INDEX api_keys_user_id_idx ON public.api_keys USING btree (user_id);

CREATE INDEX api_keys_workspace_idx ON public.api_keys USING btree (workspace_id);

CREATE POLICY "Users can read their own api keys" ON "public"."api_keys"
  FOR SELECT
  TO "authenticated"
  USING ((user_id = ( SELECT auth.uid() AS uid)));

CREATE POLICY "Workspace members can read workspace api keys" ON "public"."api_keys"
  FOR SELECT
  TO "authenticated"
  USING (public.is_active_workspace_member(workspace_id));

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."api_keys" TO "anon";

REVOKE ALL ON TABLE "public"."api_keys" FROM "authenticated";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."api_keys" TO "service_role";

REVOKE ALL ("badge_domains") ON TABLE "public"."api_keys" FROM "authenticated";

GRANT SELECT ("badge_domains") ON TABLE "public"."api_keys" TO "authenticated";

REVOKE ALL ("created_at") ON TABLE "public"."api_keys" FROM "authenticated";

GRANT SELECT ("created_at") ON TABLE "public"."api_keys" TO "authenticated";

REVOKE ALL ("created_by") ON TABLE "public"."api_keys" FROM "authenticated";

GRANT SELECT ("created_by") ON TABLE "public"."api_keys" TO "authenticated";

REVOKE ALL ("expires_at") ON TABLE "public"."api_keys" FROM "authenticated";

GRANT SELECT ("expires_at") ON TABLE "public"."api_keys" TO "authenticated";

REVOKE ALL ("id") ON TABLE "public"."api_keys" FROM "authenticated";

GRANT SELECT ("id") ON TABLE "public"."api_keys" TO "authenticated";

REVOKE ALL ("label") ON TABLE "public"."api_keys" FROM "authenticated";

GRANT SELECT ("label") ON TABLE "public"."api_keys" TO "authenticated";

REVOKE ALL ("last_used_at") ON TABLE "public"."api_keys" FROM "authenticated";

GRANT SELECT ("last_used_at") ON TABLE "public"."api_keys" TO "authenticated";

REVOKE ALL ("plan") ON TABLE "public"."api_keys" FROM "authenticated";

GRANT SELECT ("plan") ON TABLE "public"."api_keys" TO "authenticated";

REVOKE ALL ("prefix") ON TABLE "public"."api_keys" FROM "authenticated";

GRANT SELECT ("prefix") ON TABLE "public"."api_keys" TO "authenticated";

REVOKE ALL ("revoked_at") ON TABLE "public"."api_keys" FROM "authenticated";

GRANT SELECT ("revoked_at") ON TABLE "public"."api_keys" TO "authenticated";

REVOKE ALL ("scopes") ON TABLE "public"."api_keys" FROM "authenticated";

GRANT SELECT ("scopes") ON TABLE "public"."api_keys" TO "authenticated";

REVOKE ALL ("user_id") ON TABLE "public"."api_keys" FROM "authenticated";

GRANT SELECT ("user_id") ON TABLE "public"."api_keys" TO "authenticated";

REVOKE ALL ("workspace_id") ON TABLE "public"."api_keys" FROM "authenticated";

GRANT SELECT ("workspace_id") ON TABLE "public"."api_keys" TO "authenticated";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."api_keys" TO "authenticated";

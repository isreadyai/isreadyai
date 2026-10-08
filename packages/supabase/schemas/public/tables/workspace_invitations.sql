CREATE TABLE "public"."workspace_invitations" (
  "id"           uuid                     NOT NULL DEFAULT gen_random_uuid(),
  "workspace_id" uuid                     NOT NULL,
  "email"        text                     NOT NULL,
  "role"         text                     NOT NULL DEFAULT 'member'::text,
  "token_hash"   text                     NOT NULL,
  "invited_by"   uuid,
  "expires_at"   timestamp with time zone NOT NULL,
  "accepted_at"  timestamp with time zone,
  "revoked_at"   timestamp with time zone,
  "created_at"   timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT "workspace_invitations_invited_by_fkey" FOREIGN KEY (invited_by) REFERENCES auth.users(id) ON DELETE SET NULL,
  CONSTRAINT "workspace_invitations_pkey" PRIMARY KEY (id),
  CONSTRAINT "workspace_invitations_role_check" CHECK ((role = ANY (ARRAY['owner'::text, 'admin'::text, 'member'::text, 'viewer'::text, 'billing'::text]))),
  CONSTRAINT "workspace_invitations_token_hash_key" UNIQUE (token_hash),
  CONSTRAINT "workspace_invitations_workspace_id_fkey" FOREIGN KEY (workspace_id) REFERENCES public.workspaces(id) ON DELETE CASCADE
);

ALTER TABLE "public"."workspace_invitations"
  ENABLE ROW LEVEL SECURITY;

CREATE INDEX workspace_invitations_email_idx ON public.workspace_invitations USING btree (email);

CREATE INDEX workspace_invitations_invited_by_idx ON public.workspace_invitations USING btree (invited_by);

CREATE INDEX workspace_invitations_workspace_idx ON public.workspace_invitations USING btree (workspace_id);

CREATE POLICY "Members can read invitations of their workspaces" ON "public"."workspace_invitations"
  FOR SELECT
  TO "authenticated"
  USING (public.is_active_workspace_member(workspace_id));

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."workspace_invitations" TO "anon";

REVOKE ALL ON TABLE "public"."workspace_invitations" FROM "authenticated";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."workspace_invitations" TO "service_role";

REVOKE ALL ("accepted_at") ON TABLE "public"."workspace_invitations" FROM "authenticated";

GRANT SELECT ("accepted_at") ON TABLE "public"."workspace_invitations" TO "authenticated";

REVOKE ALL ("created_at") ON TABLE "public"."workspace_invitations" FROM "authenticated";

GRANT SELECT ("created_at") ON TABLE "public"."workspace_invitations" TO "authenticated";

REVOKE ALL ("email") ON TABLE "public"."workspace_invitations" FROM "authenticated";

GRANT SELECT ("email") ON TABLE "public"."workspace_invitations" TO "authenticated";

REVOKE ALL ("expires_at") ON TABLE "public"."workspace_invitations" FROM "authenticated";

GRANT SELECT ("expires_at") ON TABLE "public"."workspace_invitations" TO "authenticated";

REVOKE ALL ("id") ON TABLE "public"."workspace_invitations" FROM "authenticated";

GRANT SELECT ("id") ON TABLE "public"."workspace_invitations" TO "authenticated";

REVOKE ALL ("invited_by") ON TABLE "public"."workspace_invitations" FROM "authenticated";

GRANT SELECT ("invited_by") ON TABLE "public"."workspace_invitations" TO "authenticated";

REVOKE ALL ("revoked_at") ON TABLE "public"."workspace_invitations" FROM "authenticated";

GRANT SELECT ("revoked_at") ON TABLE "public"."workspace_invitations" TO "authenticated";

REVOKE ALL ("role") ON TABLE "public"."workspace_invitations" FROM "authenticated";

GRANT SELECT ("role") ON TABLE "public"."workspace_invitations" TO "authenticated";

REVOKE ALL ("workspace_id") ON TABLE "public"."workspace_invitations" FROM "authenticated";

GRANT SELECT ("workspace_id") ON TABLE "public"."workspace_invitations" TO "authenticated";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."workspace_invitations" TO "authenticated";

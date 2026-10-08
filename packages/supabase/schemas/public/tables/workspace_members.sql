CREATE TABLE "public"."workspace_members" (
  "id"             uuid                     NOT NULL DEFAULT gen_random_uuid(),
  "workspace_id"   uuid                     NOT NULL,
  "user_id"        uuid                     NOT NULL,
  "role"           text                     NOT NULL DEFAULT 'member'::text,
  "status"         text                     NOT NULL DEFAULT 'active'::text,
  "seat_billable"  boolean                  NOT NULL DEFAULT true,
  "joined_at"      timestamp with time zone,
  "suspended_at"   timestamp with time zone,
  "last_active_at" timestamp with time zone,
  "created_at"     timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT "workspace_members_pkey" PRIMARY KEY (id),
  CONSTRAINT "workspace_members_role_check" CHECK ((role = ANY (ARRAY['owner'::text, 'admin'::text, 'member'::text, 'viewer'::text, 'billing'::text]))),
  CONSTRAINT "workspace_members_status_check" CHECK ((status = ANY (ARRAY['active'::text, 'suspended'::text, 'invited'::text]))),
  CONSTRAINT "workspace_members_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE,
  CONSTRAINT "workspace_members_workspace_id_user_id_key" UNIQUE (workspace_id, user_id),
  CONSTRAINT "workspace_members_workspace_id_fkey" FOREIGN KEY (workspace_id) REFERENCES public.workspaces(id) ON DELETE CASCADE
);

ALTER TABLE "public"."workspace_members"
  ENABLE ROW LEVEL SECURITY;

CREATE INDEX workspace_members_user_workspace_idx ON public.workspace_members USING btree (user_id, workspace_id);

CREATE INDEX workspace_members_workspace_idx ON public.workspace_members USING btree (workspace_id);

CREATE CONSTRAINT TRIGGER workspace_owner_guard
  AFTER DELETE OR UPDATE ON public.workspace_members DEFERRABLE INITIALLY DEFERRED
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_workspace_owner();

CREATE POLICY "Members can read membership of their workspaces" ON "public"."workspace_members"
  FOR SELECT
  TO "authenticated"
  USING (public.is_active_workspace_member(workspace_id));

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."workspace_members" TO "anon", "authenticated", "service_role";

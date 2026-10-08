CREATE TABLE "public"."audit_events" (
  "id"            uuid                     NOT NULL DEFAULT gen_random_uuid(),
  "workspace_id"  uuid                     NOT NULL,
  "actor_user_id" uuid,
  "action"        text                     NOT NULL,
  "target_type"   text,
  "target_id"     uuid,
  "metadata"      jsonb,
  "created_at"    timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT "audit_events_actor_user_id_fkey" FOREIGN KEY (actor_user_id) REFERENCES auth.users(id) ON DELETE SET NULL,
  CONSTRAINT "audit_events_pkey" PRIMARY KEY (id),
  CONSTRAINT "audit_events_workspace_id_fkey" FOREIGN KEY (workspace_id) REFERENCES public.workspaces(id) ON DELETE CASCADE
);

ALTER TABLE "public"."audit_events"
  ENABLE ROW LEVEL SECURITY;

CREATE INDEX audit_events_actor_user_id_idx ON public.audit_events USING btree (actor_user_id);

CREATE INDEX audit_events_workspace_idx ON public.audit_events USING btree (workspace_id, created_at DESC);

CREATE POLICY "Members can read audit events of their workspaces" ON "public"."audit_events"
  FOR SELECT
  TO "authenticated"
  USING (public.is_active_workspace_member(workspace_id));

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."audit_events" TO "anon", "authenticated", "service_role";

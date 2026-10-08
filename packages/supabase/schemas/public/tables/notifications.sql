CREATE TABLE "public"."notifications" (
  "id"            uuid                     NOT NULL DEFAULT gen_random_uuid(),
  "workspace_id"  uuid                     NOT NULL,
  "user_id"       uuid,
  "type"          text                     NOT NULL,
  "severity"      text                     NOT NULL DEFAULT 'info'::text,
  "resource_type" text,
  "resource_id"   uuid,
  "title"         text                     NOT NULL,
  "body"          text,
  "payload"       jsonb,
  "read_at"       timestamp with time zone,
  "created_at"    timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT "notifications_pkey" PRIMARY KEY (id),
  CONSTRAINT "notifications_severity_check" CHECK ((severity = ANY (ARRAY['info'::text, 'warning'::text, 'error'::text, 'success'::text]))),
  CONSTRAINT "notifications_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE,
  CONSTRAINT "notifications_workspace_id_fkey" FOREIGN KEY (workspace_id) REFERENCES public.workspaces(id) ON DELETE CASCADE
);

ALTER TABLE "public"."notifications"
  ENABLE ROW LEVEL SECURITY;

CREATE INDEX notifications_user_read_idx ON public.notifications USING btree (user_id, read_at);

CREATE INDEX notifications_workspace_user_idx ON public.notifications USING btree (workspace_id, user_id, created_at DESC);

CREATE POLICY "Members can read their notifications" ON "public"."notifications"
  FOR SELECT
  TO "authenticated"
  USING (((user_id = ( SELECT auth.uid() AS uid)) OR ((user_id IS NULL) AND public.is_active_workspace_member(workspace_id))));

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."notifications" TO "anon", "authenticated", "service_role";

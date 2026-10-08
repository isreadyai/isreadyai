CREATE TABLE "public"."notification_preferences" (
  "id"           uuid                     NOT NULL DEFAULT gen_random_uuid(),
  "workspace_id" uuid                     NOT NULL,
  "user_id"      uuid                     NOT NULL,
  "event_type"   text                     NOT NULL,
  "in_app"       boolean                  NOT NULL DEFAULT true,
  "email"        boolean                  NOT NULL DEFAULT true,
  "webhook"      boolean                  NOT NULL DEFAULT false,
  "digest"       text                     NOT NULL DEFAULT 'immediate'::text,
  "created_at"   timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT "notification_preferences_digest_check" CHECK ((digest = ANY (ARRAY['immediate'::text, 'daily'::text, 'weekly'::text, 'off'::text]))),
  CONSTRAINT "notification_preferences_pkey" PRIMARY KEY (id),
  CONSTRAINT "notification_preferences_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE,
  CONSTRAINT "notification_preferences_workspace_id_user_id_event_type_key" UNIQUE (workspace_id, user_id, event_type),
  CONSTRAINT "notification_preferences_workspace_id_fkey" FOREIGN KEY (workspace_id) REFERENCES public.workspaces(id) ON DELETE CASCADE
);

ALTER TABLE "public"."notification_preferences"
  ENABLE ROW LEVEL SECURITY;

CREATE INDEX notification_preferences_user_id_idx ON public.notification_preferences USING btree (user_id);

CREATE POLICY "Users can read their own notification preferences" ON "public"."notification_preferences"
  FOR SELECT
  TO "authenticated"
  USING ((user_id = ( SELECT auth.uid() AS uid)));

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."notification_preferences" TO "anon", "authenticated", "service_role";

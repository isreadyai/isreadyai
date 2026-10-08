CREATE TABLE "public"."chat_threads" (
  "id"         uuid                     NOT NULL DEFAULT gen_random_uuid(),
  "user_id"    uuid                     NOT NULL,
  "host"       text                     NOT NULL,
  "scan_id"    uuid,
  "messages"   jsonb                    NOT NULL DEFAULT '[]'::jsonb,
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at" timestamp with time zone NOT NULL DEFAULT now(),
  "website_id" uuid,
  CONSTRAINT "chat_threads_pkey" PRIMARY KEY (id),
  CONSTRAINT "chat_threads_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE,
  CONSTRAINT "chat_threads_scan_id_fkey" FOREIGN KEY (scan_id) REFERENCES public.scans(id) ON DELETE SET NULL,
  CONSTRAINT "chat_threads_website_id_fkey" FOREIGN KEY (website_id) REFERENCES public.websites(id) ON DELETE CASCADE
);

ALTER TABLE "public"."chat_threads"
  ENABLE ROW LEVEL SECURITY;

CREATE INDEX chat_threads_scan_id_idx ON public.chat_threads USING btree (scan_id);

CREATE INDEX chat_threads_user_host_idx ON public.chat_threads USING btree (user_id, host);

CREATE INDEX chat_threads_user_id_idx ON public.chat_threads USING btree (user_id);

CREATE UNIQUE INDEX chat_threads_user_scan_key ON public.chat_threads USING btree (user_id, scan_id)
  WHERE ((website_id IS NULL) AND (scan_id IS NOT NULL));

CREATE INDEX chat_threads_user_website_idx ON public.chat_threads USING btree (user_id, website_id);

CREATE UNIQUE INDEX chat_threads_user_website_key ON public.chat_threads USING btree (user_id, website_id)
  WHERE (website_id IS NOT NULL);

CREATE POLICY "Users can read their own chat threads" ON "public"."chat_threads"
  FOR SELECT
  TO "authenticated"
  USING ((user_id = ( SELECT auth.uid() AS uid)));

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."chat_threads" TO "anon", "authenticated", "service_role";

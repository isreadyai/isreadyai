CREATE TABLE "public"."ai_usage" (
  "id"            uuid                     NOT NULL DEFAULT gen_random_uuid(),
  "user_id"       uuid,
  "api_key_id"    uuid,
  "surface"       text                     NOT NULL,
  "period"        text                     NOT NULL,
  "generation_id" text,
  "messages"      integer                  NOT NULL DEFAULT 0,
  "tokens"        bigint                   NOT NULL DEFAULT 0,
  "created_at"    timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at"    timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT "ai_usage_messages_check" CHECK ((messages >= 0)),
  CONSTRAINT "ai_usage_owner_present" CHECK (((user_id IS NOT NULL) OR (api_key_id IS NOT NULL))),
  CONSTRAINT "ai_usage_period_check" CHECK ((period ~ '^[0-9]{6}$'::text)),
  CONSTRAINT "ai_usage_pkey" PRIMARY KEY (id),
  CONSTRAINT "ai_usage_surface_check" CHECK ((surface = ANY (ARRAY['chat'::text, 'mcp'::text, 'solve'::text]))),
  CONSTRAINT "ai_usage_tokens_check" CHECK ((tokens >= 0)),
  CONSTRAINT "ai_usage_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE,
  CONSTRAINT "ai_usage_api_key_id_fkey" FOREIGN KEY (api_key_id) REFERENCES public.api_keys(id) ON DELETE SET NULL
);

ALTER TABLE "public"."ai_usage"
  ENABLE ROW LEVEL SECURITY;

CREATE INDEX ai_usage_api_key_id_idx ON public.ai_usage USING btree (api_key_id);

CREATE UNIQUE INDEX ai_usage_generation_id_key ON public.ai_usage USING btree (generation_id)
  WHERE (generation_id IS NOT NULL);

CREATE INDEX ai_usage_owner_surface_period_idx ON public.ai_usage USING btree (COALESCE(user_id, api_key_id), surface, period);

CREATE INDEX ai_usage_user_id_idx ON public.ai_usage USING btree (user_id);

CREATE POLICY "Users can read their own ai usage" ON "public"."ai_usage"
  FOR SELECT
  TO "authenticated"
  USING ((user_id = ( SELECT auth.uid() AS uid)));

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."ai_usage" TO "anon", "authenticated", "service_role";

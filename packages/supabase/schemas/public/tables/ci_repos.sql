CREATE TABLE "public"."ci_repos" (
  "id"            uuid                     NOT NULL DEFAULT gen_random_uuid(),
  "slug"          text                     NOT NULL,
  "repository_id" text                     NOT NULL,
  "owner_repo"    text                     NOT NULL,
  "api_key_id"    uuid,
  "user_id"       uuid,
  "created_at"    timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at"    timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT "ci_repos_api_key_id_fkey" FOREIGN KEY (api_key_id) REFERENCES public.api_keys(id) ON DELETE SET NULL,
  CONSTRAINT "ci_repos_pkey" PRIMARY KEY (id),
  CONSTRAINT "ci_repos_repository_id_key" UNIQUE (repository_id),
  CONSTRAINT "ci_repos_slug_key" UNIQUE (slug),
  CONSTRAINT "ci_repos_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE
);

ALTER TABLE "public"."ci_repos"
  ENABLE ROW LEVEL SECURITY;

CREATE INDEX ci_repos_api_key_id_idx ON public.ci_repos USING btree (api_key_id);

CREATE INDEX ci_repos_user_id_idx ON public.ci_repos USING btree (user_id);

CREATE POLICY "Users can read their own ci repos" ON "public"."ci_repos"
  FOR SELECT
  TO "authenticated"
  USING ((user_id = ( SELECT auth.uid() AS uid)));

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."ci_repos" TO "anon", "authenticated", "service_role";

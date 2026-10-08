CREATE TABLE "public"."ci_reports" (
  "id"         uuid                     NOT NULL DEFAULT gen_random_uuid(),
  "repo_id"    uuid                     NOT NULL,
  "scan_id"    uuid,
  "branch"     text                     NOT NULL,
  "commit_sha" text                     NOT NULL,
  "score"      integer,
  "grade"      text,
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT "ci_reports_pkey" PRIMARY KEY (id),
  CONSTRAINT "ci_reports_score_check" CHECK (((score IS NULL) OR ((score >= 0) AND (score <= 100)))),
  CONSTRAINT "ci_reports_repo_id_fkey" FOREIGN KEY (repo_id) REFERENCES public.ci_repos(id) ON DELETE CASCADE,
  CONSTRAINT "ci_reports_scan_id_fkey" FOREIGN KEY (scan_id) REFERENCES public.scans(id) ON DELETE SET NULL
);

ALTER TABLE "public"."ci_reports"
  ENABLE ROW LEVEL SECURITY;

CREATE INDEX ci_reports_branch_idx ON public.ci_reports USING btree (repo_id, branch, created_at DESC);

CREATE INDEX ci_reports_commit_idx ON public.ci_reports USING btree (repo_id, commit_sha, created_at DESC);

CREATE INDEX ci_reports_scan_id_idx ON public.ci_reports USING btree (scan_id);

CREATE POLICY "Users can read their own ci reports" ON "public"."ci_reports"
  FOR SELECT
  TO "authenticated"
  USING ((repo_id IN ( SELECT ci_repos.id
   FROM public.ci_repos
  WHERE (ci_repos.user_id = ( SELECT auth.uid() AS uid)))));

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."ci_reports" TO "anon", "authenticated", "service_role";

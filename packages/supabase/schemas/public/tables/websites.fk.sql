-- Foreign keys in a cross-table reference cycle are split out of their
-- table's file: each file loads atomically, so keeping them inline would
-- deadlock the loader (every file would need a table another pending file
-- creates). These statements apply once all referenced tables exist.

ALTER TABLE "public"."websites"
  ADD CONSTRAINT "domains_public_report_id_fkey" FOREIGN KEY (public_report_id) REFERENCES public.scans(id) ON DELETE SET NULL;

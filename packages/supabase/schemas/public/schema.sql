REVOKE ALL ON SCHEMA "public" FROM "anon";

GRANT USAGE ON SCHEMA "public" TO "anon";

REVOKE ALL ON SCHEMA "public" FROM "authenticated";

GRANT USAGE ON SCHEMA "public" TO "authenticated";

REVOKE ALL ON SCHEMA "public" FROM "postgres";

GRANT CREATE, USAGE ON SCHEMA "public" TO "postgres";

REVOKE ALL ON SCHEMA "public" FROM "service_role";

GRANT CREATE, USAGE ON SCHEMA "public" TO "service_role";

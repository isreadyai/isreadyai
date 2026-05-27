/**
 * JSON value compatible with Postgres json/jsonb columns.
 *
 * Mirrors the shape emitted by Supabase's generated types so reports bridge JSONB losslessly.
 *
 * @typedef {Json}
 * @export
 */
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type TActionResult<TSuccess extends object = Record<never, never>> =
  | ({ ok: true } & TSuccess)
  | { ok: false; error: string }

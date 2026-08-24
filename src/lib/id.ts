// crypto.randomUUID() isn't available in the Hermes runtime — generate an
// RFC4122 v4 UUID by hand. Use this anywhere an id must satisfy a Postgres
// `uuid` column (Supabase sessions/events/alerts ids).
export function generateUUID(): string {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

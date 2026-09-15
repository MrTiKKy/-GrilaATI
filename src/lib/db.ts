import { neon } from "@neondatabase/serverless";

export function getDb() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error("DATABASE_URL lipsește din .env");
  }
  return neon(url);
}

export type Sql = ReturnType<typeof getDb>;

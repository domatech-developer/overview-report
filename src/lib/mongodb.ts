import { MongoClient } from "mongodb";

let client: any = null;
let db: any = null;

export async function getDb(): Promise<any> {
  if (db) return db;
  const uri = process.env.MONGODB_URI as string | undefined;
  const dbName = (process.env.MONGODB_DB as string | undefined) || "overview";
  if (!uri) throw new Error("MONGODB_URI not set");
  client = new MongoClient(uri as any);
  await client.connect();
  db = client.db(dbName);
  return db;
}

export async function closeDb() {
  if (client) {
    await client.close();
    client = null;
    db = null;
  }
}

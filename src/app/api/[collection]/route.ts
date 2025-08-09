import { NextResponse } from "next/server";
import { getDb } from "@/lib/mongodb";

const allowed = new Set(["clients", "subprojects", "tasks", "collaborators", "events"]);

export async function GET(_req: Request, { params }: { params: Promise<{ collection: string }> }) {
  const { collection } = await params;
  if (!allowed.has(collection)) return NextResponse.json({ error: "not found" }, { status: 404 });
  const db = await getDb();
  const items = await db.collection(collection).find({}).toArray();
  // Map _id to id for client compatibility, without mutating DB
  const normalized = items.map((doc: any) => {
    const { _id, ...rest } = doc || {};
    const id = doc?.id || (typeof _id !== "undefined" ? String(_id) : undefined);
    return { id, ...rest };
  });
  return NextResponse.json(normalized);
}

function uid(prefix: string) {
  return `${prefix}_${Math.random().toString(36).slice(2, 9)}`;
}

export async function POST(req: Request, { params }: { params: Promise<{ collection: string }> }) {
  const { collection } = await params;
  if (!allowed.has(collection)) return NextResponse.json({ error: "not found" }, { status: 404 });
  const body = await req.json();
  if (!body.id) body.id = uid(collection[0]);
  const db = await getDb();
  await db.collection(collection).insertOne(body);
  return NextResponse.json(body, { status: 201 });
}

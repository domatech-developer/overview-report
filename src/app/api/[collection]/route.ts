import { NextResponse } from "next/server";
import { getDb } from "@/lib/mongodb";

const allowed = new Set(["clients", "subprojects", "tasks", "collaborators", "events"]);

export async function GET(_req: Request, { params }: { params: Promise<{ collection: string }> }) {
  const { collection } = await params;
  if (!allowed.has(collection)) return NextResponse.json({ error: "not found" }, { status: 404 });
  const db = await getDb();
  const items = await db.collection(collection).find({}).toArray();
  return NextResponse.json(items);
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

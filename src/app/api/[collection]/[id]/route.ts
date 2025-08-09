import { NextResponse } from "next/server";
import { getDb } from "@/lib/mongodb";
import { ObjectId } from "mongodb";

const allowed = new Set(["clients", "subprojects", "tasks", "collaborators", "events"]);

export async function PUT(req: Request, { params }: { params: Promise<{ collection: string; id: string }> }) {
  const { collection, id } = await params;
  if (!allowed.has(collection)) return NextResponse.json({ error: "not found" }, { status: 404 });
  const body = await req.json();
  const db = await getDb();
  // Update by custom id or Mongo _id
  const ors: any[] = [{ id }];
  try {
    ors.push({ _id: new ObjectId(id) });
  } catch {}
  const filter = ors.length > 1 ? { $or: ors } : { id };
  await db.collection(collection).updateOne(filter, { $set: body }, { upsert: false });
  return NextResponse.json(body);
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ collection: string; id: string }> }) {
  const { collection, id } = await params;
  if (!allowed.has(collection)) return NextResponse.json({ error: "not found" }, { status: 404 });
  const db = await getDb();
  const ors: any[] = [{ id }];
  try {
    ors.push({ _id: new ObjectId(id) });
  } catch {}
  const filter = ors.length > 1 ? { $or: ors } : { id };
  await db.collection(collection).deleteOne(filter);
  return NextResponse.json({ ok: true });
}

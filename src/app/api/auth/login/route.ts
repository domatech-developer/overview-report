import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/mongodb";
import { cookies } from "next/headers";
import crypto from "crypto";

function hashPassword(pw: string) {
  return crypto.createHash("sha256").update(pw).digest("hex");
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { email, password } = body || {};
  if (!email || !password) return NextResponse.json({ error: "missing" }, { status: 400 });
  const db = await getDb();
  const user = await db.collection("users").findOne({ email: String(email).toLowerCase() });
  if (!user) return NextResponse.json({ error: "invalid" }, { status: 401 });
  const stored = (user as any).password; // should be hashed
  const ok = stored && (stored.length === 64 ? stored === hashPassword(password) : stored === password);
  if (!ok) return NextResponse.json({ error: "invalid" }, { status: 401 });

  const token = crypto.randomBytes(24).toString("hex");
  // naive in-memory-less token: just set cookie with token; in prod, persist or sign/JWT
  (await cookies()).set("session_token", token, { httpOnly: true, sameSite: "lax", path: "/" });
  return NextResponse.json({ ok: true });
}

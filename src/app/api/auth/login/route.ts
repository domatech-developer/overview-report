import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/mongodb";
import { cookies } from "next/headers";
import crypto from "crypto";
import { signSession } from "@/lib/auth";

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

  const payload = { sub: String((user as any)._id), email: String((user as any).email), name: (user as any).name } as const;
  const token = await signSession(payload, "7d");
  (await cookies()).set("session_token", token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 7, // 7 days
  });
  return NextResponse.json({ ok: true, user: payload });
}

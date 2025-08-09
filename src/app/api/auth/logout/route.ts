import { NextResponse } from "next/server";
import { cookies } from "next/headers";

export async function POST() {
  const c = await cookies();
  // delete with matching attributes
  c.set("session_token", "", { path: "/", httpOnly: true, expires: new Date(0), sameSite: "lax", secure: process.env.NODE_ENV === "production" });
  return NextResponse.json({ ok: true });
}

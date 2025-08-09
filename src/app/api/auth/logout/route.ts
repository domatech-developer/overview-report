import { NextResponse } from "next/server";
import { cookies } from "next/headers";

export async function POST() {
  (await cookies()).delete("session_token");
  return NextResponse.json({ ok: true });
}

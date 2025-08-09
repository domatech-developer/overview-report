import { SignJWT, jwtVerify, type JWTPayload } from "jose";

const DEFAULT_SECRET = "dev-secret-change-me";

function getSecretKey(): Uint8Array {
  const secret = process.env.AUTH_SECRET || DEFAULT_SECRET;
  return new TextEncoder().encode(secret);
}

export interface SessionPayload extends JWTPayload {
  sub: string; // user id
  email: string;
  name?: string;
}

export async function signSession(payload: Omit<SessionPayload, "iat" | "exp" | "nbf" | "jti">, expiresIn: string = "7d") {
  const key = getSecretKey();
  const token = await new SignJWT(payload).setProtectedHeader({ alg: "HS256" }).setIssuedAt().setExpirationTime(expiresIn).sign(key);
  return token;
}

export async function verifySession(token: string): Promise<SessionPayload | null> {
  try {
    const key = getSecretKey();
    const { payload } = await jwtVerify(token, key, { algorithms: ["HS256"] });
    return payload as SessionPayload;
  } catch {
    return null;
  }
}

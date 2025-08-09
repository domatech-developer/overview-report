"use client";

import React, { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { auth, onAuthStateChanged, signOut } from "@/lib/firebase";

const PUBLIC_ROUTES = new Set(["/login"]);

export function AuthGate({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u: any) => {
      setUser(u);
      setLoading(false);
    });
    return () => unsub();
  }, []);

  useEffect(() => {
    if (loading) return;
    const isPublic = PUBLIC_ROUTES.has(pathname || "/");
    if (!user && !isPublic) router.replace("/login");
    if (user && pathname === "/login") router.replace("/");
  }, [user, loading, pathname, router]);

  if (loading) return <div className="flex h-96 items-center justify-center text-zinc-400">Carregando…</div>;

  return (
    <div>
      {user && (
        <div className="sticky top-0 z-50 mb-2 border-b border-zinc-800/60 bg-zinc-950/50 backdrop-blur">
          <div className="mx-auto max-w-7xl px-6 py-2 text-right">
            <button
              onClick={() => signOut(auth)}
              className="inline-flex items-center gap-2 rounded-md border border-zinc-800/60 px-2 py-1 text-xs hover:bg-zinc-900"
            >
              Sair
            </button>
          </div>
        </div>
      )}
      {children}
    </div>
  );
}

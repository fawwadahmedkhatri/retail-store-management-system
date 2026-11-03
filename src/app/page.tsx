"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { useStore } from "@/lib/store";

export default function Home() {
  const store = useStore();
  const router = useRouter();
  useEffect(() => {
    if (!store) return;
    router.replace(!store.user ? "/login" : store.isAdmin ? "/dashboard" : "/pos");
  }, [store, router]);
  return null;
}

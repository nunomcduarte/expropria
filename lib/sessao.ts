"use client";

import { useEffect, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { supabase, supabaseConfigurado } from "./supabase";
import { Perfil } from "./tipos";

export function useSessao() {
  const [user, setUser] = useState<User | null>(null);
  const [perfil, setPerfil] = useState<Perfil | null>(null);

  useEffect(() => {
    if (!supabaseConfigurado) return;
    supabase.auth.getSession().then(({ data }) => setUser(data.session?.user ?? null));
    const { data } = supabase.auth.onAuthStateChange((_e, s) => setUser(s?.user ?? null));
    return () => data.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!user) return setPerfil(null);
    supabase.from("perfis").select("id, nome_publico, moderador").eq("id", user.id).single()
      .then(({ data }) => setPerfil(data as Perfil | null));
  }, [user]);

  return { user, perfil };
}

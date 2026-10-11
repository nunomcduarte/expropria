"use client";

import Link from "next/link";
import { supabase } from "@/lib/supabase";

type Props = {
  ativo: "mapa" | "lista";
  logado: boolean;
  nome?: string | null;
  moderador?: boolean;
  onEntrar: (modo: "entrar" | "registar") => void;
};

export default function BarraTopo({ ativo, logado, nome, moderador, onEntrar }: Props) {
  return (
    <header className="barra-topo">
      <Link href="/" className="marca" aria-label="Expropria PCP, página inicial">
        Expropria<span>PCP</span>
      </Link>
      <nav className="separadores" aria-label="Secções">
        <Link href="/" className={ativo === "mapa" ? "ativo" : ""} aria-current={ativo === "mapa" ? "page" : undefined}>
          Mapa
        </Link>
        <Link href="/imoveis" className={ativo === "lista" ? "ativo" : ""} aria-current={ativo === "lista" ? "page" : undefined}>
          Lista<span className="so-pc"> de imóveis</span>
        </Link>
        {moderador && <Link href="/admin">Denúncias</Link>}
      </nav>
      <div className="conta">
        {logado ? (
          <>
            {nome && <span className="conta-nome">{nome}</span>}
            <button className="bt-entrar" onClick={() => supabase.auth.signOut()}>Sair</button>
          </>
        ) : (
          <>
            <button className="bt-entrar" onClick={() => onEntrar("entrar")}>Entrar</button>
            <button className="bt-registar" onClick={() => onEntrar("registar")}>Registar</button>
          </>
        )}
      </div>
    </header>
  );
}

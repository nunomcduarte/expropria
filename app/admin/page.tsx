"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useSessao } from "@/lib/sessao";
import { DadosAdmin, ImovelAdmin, carregarDadosAdmin } from "@/lib/admin";
import Painel from "@/components/admin/Painel";
import Denuncias from "@/components/admin/Denuncias";
import TabelaImoveis from "@/components/admin/TabelaImoveis";

type Separador = "painel" | "denuncias" | "imoveis";

export default function Admin() {
  const { perfil } = useSessao();
  const [separador, setSeparador] = useState<Separador>("painel");
  const [dados, setDados] = useState<DadosAdmin | null>(null);

  const carregar = useCallback(() => { carregarDadosAdmin().then(setDados); }, []);
  useEffect(() => { if (perfil?.moderador) carregar(); }, [perfil, carregar]);

  async function mudarEstado(i: ImovelAdmin, estado: "aprovado" | "rejeitado") {
    const { error } = await supabase.from("imoveis").update({
      estado, motivo_rejeicao: estado === "rejeitado" ? "removido no painel" : null,
      moderado_por: perfil!.id, moderado_em: new Date().toISOString(),
    }).eq("id", i.id);
    if (error) return alert(error.message);
    carregar();
  }

  const abertas = dados?.denuncias.filter((d) => !d.resolvida).length ?? 0;

  return (
    <div className="adm">
      <header className="adm-topo">
        <Link href="/" className="adm-logo">Expropria <span>PCP</span></Link>
        {perfil?.moderador && (
          <nav>
            <button className={separador === "painel" ? "ativo" : ""} onClick={() => setSeparador("painel")}>Painel</button>
            <button className={separador === "denuncias" ? "ativo" : ""} onClick={() => setSeparador("denuncias")}>Denúncias · {abertas}</button>
            <button className={separador === "imoveis" ? "ativo" : ""} onClick={() => setSeparador("imoveis")}>Imóveis</button>
            <Link href="/" className="voltar">← Voltar ao mapa</Link>
          </nav>
        )}
      </header>
      <main className="adm-corpo">
        {!perfil && <p>É preciso <Link href="/">entrar</Link> como administrador.</p>}
        {perfil && !perfil.moderador && <p>Esta página é só para administradores.</p>}
        {perfil?.moderador && !dados && <p className="vazio">A carregar…</p>}
        {perfil?.moderador && dados && separador === "painel" && (
          <>
            <Painel dados={dados} irPara={setSeparador} />
            <TabelaImoveis dados={dados} mudarEstado={mudarEstado} />
          </>
        )}
        {perfil?.moderador && separador === "denuncias" && <Denuncias perfil={perfil} aoMudar={carregar} />}
        {perfil?.moderador && dados && separador === "imoveis" && <TabelaImoveis dados={dados} mudarEstado={mudarEstado} />}
      </main>
    </div>
  );
}

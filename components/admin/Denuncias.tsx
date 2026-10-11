"use client";

import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { haQuanto } from "@/lib/admin";
import { MOTIVOS_DENUNCIA, Perfil, numeroFicha } from "@/lib/tipos";

type Denuncia = {
  id: string;
  imovel_id: string | null;
  foto_id: string | null;
  motivo: keyof typeof MOTIVOS_DENUNCIA;
  detalhe: string | null;
  contacto: string | null;
  criada_em: string;
  imoveis: { titulo: string; numero: number; concelho: string; estado: string } | null;
  fotos: { caminho: string; estado: string; imoveis: { titulo: string; numero: number } | null } | null;
};

export default function Denuncias({ perfil, aoMudar }: { perfil: Perfil; aoMudar: () => void }) {
  const [lista, setLista] = useState<Denuncia[]>([]);
  const [fotoUrls, setFotoUrls] = useState<Record<string, string>>({});

  const carregar = useCallback(async () => {
    const { data } = await supabase
      .from("denuncias")
      .select("*, imoveis(titulo, numero, concelho, estado), fotos(caminho, estado, imoveis(titulo, numero))")
      .eq("resolvida", false)
      .order("criada_em");
    // dados pessoais primeiro
    const l = ((data ?? []) as Denuncia[]).sort(
      (a, b) => Number(b.motivo === "dados_pessoais") - Number(a.motivo === "dados_pessoais")
    );
    setLista(l);
    const caminhos = l.map((d) => d.fotos?.caminho).filter(Boolean) as string[];
    if (caminhos.length) {
      const { data: urls } = await supabase.storage.from("fotos").createSignedUrls(caminhos, 3600);
      setFotoUrls(Object.fromEntries((urls ?? []).map((u) => [u.path, u.signedUrl])));
    }
  }, []);

  useEffect(() => { carregar(); }, [carregar]);

  async function resolver(d: Denuncia, removerConteudo: boolean) {
    if (removerConteudo) {
      const { error } = d.foto_id
        ? await supabase.from("fotos").update({ estado: "rejeitado" }).eq("id", d.foto_id)
        : await supabase.from("imoveis").update({ estado: "rejeitado", motivo_rejeicao: d.motivo, moderado_por: perfil.id, moderado_em: new Date().toISOString() }).eq("id", d.imovel_id!);
      if (error) return alert(error.message);
    }
    await supabase.from("denuncias").update({ resolvida: true }).eq("id", d.id);
    carregar();
    aoMudar();
  }

  return (
    <>
      <div className="adm-cabecalho">
        <h1 className="grande-numero"><strong>{lista.length}</strong><span>Denúncias<br />por resolver</span></h1>
        <small>Dados pessoais primeiro.</small>
      </div>
      {lista.length === 0 && <p className="vazio">Nada por resolver.</p>}
      {lista.map((d) => {
        const imovel = d.imoveis ?? d.fotos?.imoveis;
        return (
          <article key={d.id} className={`denuncia ${d.motivo === "dados_pessoais" ? "urgente" : ""}`}>
            {d.fotos && fotoUrls[d.fotos.caminho]
              // eslint-disable-next-line @next/next/no-img-element
              ? <img src={fotoUrls[d.fotos.caminho]} alt="" />
              : <div className="sem-foto" />}
            <div className="denuncia-texto">
              <p className="denuncia-meta">
                <span className={`etiqueta cheia ${d.motivo === "dados_pessoais" ? "" : "preta"}`}>{MOTIVOS_DENUNCIA[d.motivo]}</span>
                <small>Ficha nº {imovel ? numeroFicha(imovel.numero) : "?"} · {haQuanto(d.criada_em)}</small>
              </p>
              <h3>{imovel?.titulo ?? "?"}{d.foto_id ? " · foto" : ""}</h3>
              <p>
                {d.detalhe ? `“${d.detalhe}”` : "Sem detalhes."} · {d.contacto ? `resposta para ${d.contacto}` : "sem contacto"}
                {(d.imoveis?.estado === "rejeitado" || d.fotos?.estado === "rejeitado") && " · já removido"}
              </p>
            </div>
            <div className="acoes">
              <button className="primario" onClick={() => resolver(d, true)}>Remover {d.foto_id ? "foto" : "imóvel"}</button>
              <button className="secundario" onClick={() => resolver(d, false)}>Manter e arquivar</button>
            </div>
          </article>
        );
      })}
    </>
  );
}

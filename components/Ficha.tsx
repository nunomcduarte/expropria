"use client";

import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { FONTES, Foto, Imovel, MOTIVOS_DENUNCIA, TIPOS, numeroFicha } from "@/lib/tipos";
import { EscolherFotos, enviarFotos } from "./EnviarFotos";
import type { FotoPreparada } from "@/lib/fotos";

type Props = {
  imovel: Imovel;
  userId: string | null;
  moderador: boolean;
  onFechar: () => void;
  onRemovido: () => void;
  onPedirLogin: () => void;
};

export default function Ficha({ imovel, userId, moderador, onFechar, onRemovido, onPedirLogin }: Props) {
  const [fotos, setFotos] = useState<Foto[]>([]);
  const [ampliada, setAmpliada] = useState<string | null>(null);
  const [aDenunciar, setADenunciar] = useState<{ fotoId?: string } | null>(null);
  const [aAdicionar, setAAdicionar] = useState(false);

  const carregarFotos = useCallback(async () => {
    const { data } = await supabase
      .from("fotos")
      .select("id, imovel_id, caminho, legenda")
      .eq("imovel_id", imovel.id)
      .eq("estado", "aprovado")
      .order("criada_em");
    const lista = (data ?? []) as Foto[];
    if (lista.length) {
      const { data: urls } = await supabase.storage.from("fotos").createSignedUrls(lista.map((f) => f.caminho), 3600);
      lista.forEach((f, i) => (f.url = urls?.[i]?.signedUrl ?? undefined));
    }
    setFotos(lista);
  }, [imovel.id]);

  useEffect(() => {
    carregarFotos();
  }, [carregarFotos]);

  async function remover(tabela: "imoveis" | "fotos", id: string) {
    if (!confirm("Remover do mapa?")) return;
    const { error } = await supabase
      .from(tabela)
      .update({ estado: "rejeitado", ...(tabela === "imoveis" ? { moderado_por: userId, moderado_em: new Date().toISOString() } : {}) })
      .eq("id", id);
    if (error) return alert(error.message);
    if (tabela === "imoveis") onRemovido();
    else carregarFotos();
  }

  const tipo = TIPOS[imovel.tipo];
  return (
    <aside className="painel ficha">
      <header className="painel-topo">
        <span>Ficha nº {numeroFicha(imovel.numero)}</span>
        <span className="painel-tipo">{tipo.nome}</span>
        <button className="fechar" onClick={onFechar} aria-label="Fechar">×</button>
      </header>

      {fotos.length > 0 && (
        <div className="galeria">
          {fotos.map((f) => (
            <figure key={f.id}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              {f.url && <img src={f.url} alt={f.legenda ?? imovel.titulo} onClick={() => setAmpliada(f.url!)} />}
              <figcaption>
                <button className="ligacao" onClick={() => setADenunciar({ fotoId: f.id })}>Denunciar</button>
                {moderador && <button className="ligacao" onClick={() => remover("fotos", f.id)}>Remover</button>}
              </figcaption>
            </figure>
          ))}
        </div>
      )}

      <div className="painel-corpo">
        <h2>{imovel.titulo}</h2>
        <p className="sub">{[imovel.morada, imovel.concelho, imovel.distrito].filter(Boolean).join(" · ")}</p>
        {imovel.entidade_proprietaria !== "PCP" && <p className="sub">Proprietário: {imovel.entidade_proprietaria}</p>}
        {imovel.descricao && <p>{imovel.descricao}</p>}

        <div className="fonte">
          <span className="rotulo">Fonte · {FONTES[imovel.fonte_tipo]}</span>
          <p>{imovel.fonte_nota}</p>
          {imovel.fonte_url && <a href={imovel.fonte_url} target="_blank" rel="noopener noreferrer nofollow">Ver fonte ↗</a>}
        </div>

        {aAdicionar && userId && (
          <AdicionarFotos imovelId={imovel.id} userId={userId} onFeito={() => { setAAdicionar(false); carregarFotos(); }} />
        )}
        {moderador && <button className="ligacao" onClick={() => remover("imoveis", imovel.id)}>Remover imóvel do mapa</button>}
      </div>

      <div className="acoes-bloco">
        <button className="vermelho" onClick={() => (userId ? setAAdicionar(!aAdicionar) : onPedirLogin())}>+ Fotos</button>
        <button onClick={() => setADenunciar({})}>Denunciar</button>
      </div>

      {aDenunciar && <Denuncia imovelId={imovel.id} numero={imovel.numero} fotoId={aDenunciar.fotoId} onFechar={() => setADenunciar(null)} />}
      {ampliada && (
        <div className="fundo" onClick={() => setAmpliada(null)}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img className="ampliada" src={ampliada} alt="" />
        </div>
      )}
    </aside>
  );
}

function AdicionarFotos({ imovelId, userId, onFeito }: { imovelId: string; userId: string; onFeito: () => void }) {
  const [ficheiros, setFicheiros] = useState<FotoPreparada[]>([]);
  const [aEnviar, setAEnviar] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  return (
    <div>
      <EscolherFotos ficheiros={ficheiros} setFicheiros={setFicheiros} />
      {erro && <p className="erro">{erro}</p>}
      <button
        className="primario"
        disabled={!ficheiros.length || aEnviar}
        onClick={async () => {
          setAEnviar(true);
          try {
            await enviarFotos(imovelId, userId, ficheiros);
            onFeito();
          } catch (e) {
            setErro((e as Error).message);
          } finally {
            setAEnviar(false);
          }
        }}
      >
        {aEnviar ? "A enviar…" : "Enviar fotos"}
      </button>
    </div>
  );
}

function Denuncia({ imovelId, numero, fotoId, onFechar }: { imovelId: string; numero: number; fotoId?: string; onFechar: () => void }) {
  const [motivo, setMotivo] = useState<keyof typeof MOTIVOS_DENUNCIA>(fotoId ? "foto_inadequada" : "nao_e_do_partido");
  const [detalhe, setDetalhe] = useState("");
  const [contacto, setContacto] = useState("");
  const [enviado, setEnviado] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    const { error } = await supabase.from("denuncias").insert({
      imovel_id: fotoId ? null : imovelId,
      foto_id: fotoId ?? null,
      motivo,
      detalhe: detalhe.trim() || null,
      contacto: contacto.trim() || null,
    });
    if (error) setErro(error.message);
    else setEnviado(true);
  }

  return (
    <div className="fundo" onClick={onFechar}>
      <form className="caixa" onClick={(e) => e.stopPropagation()} onSubmit={enviar}>
        <header className="caixa-topo">
          <span>Denúncia · Ficha nº {numeroFicha(numero)}{fotoId ? " · foto" : ""}</span>
          <button type="button" className="fechar" onClick={onFechar} aria-label="Fechar">×</button>
        </header>
        <div className="caixa-corpo">
        <h2>Algo está mal?</h2>
        {enviado ? (
          <p className="ok">Obrigado. Vamos analisar. Casas particulares e dados pessoais são vistos primeiro.</p>
        ) : (
          <>
            <p className="sub">Não precisas de conta. Casas particulares e dados pessoais são retirados primeiro.</p>
            <div className="opcoes" role="radiogroup" aria-label="Motivo">
              {Object.entries(MOTIVOS_DENUNCIA).map(([k, v]) => (
                <label key={k} className={`opcao ${motivo === k ? "escolhida" : ""}`}>
                  <input type="radio" name="motivo" value={k} checked={motivo === k}
                    onChange={() => setMotivo(k as keyof typeof MOTIVOS_DENUNCIA)} />
                  {v}
                </label>
              ))}
            </div>
            <label>Detalhes<textarea maxLength={1000} rows={3} value={detalhe} onChange={(e) => setDetalhe(e.target.value)} placeholder="O que está errado?" /></label>
            <label>Contacto (opcional)<input value={contacto} onChange={(e) => setContacto(e.target.value)} placeholder="email, se quiseres resposta" /></label>
            {erro && <p className="erro">{erro}</p>}
            <button className="primario">Enviar denúncia</button>
          </>
        )}
        </div>
      </form>
    </div>
  );
}

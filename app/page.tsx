"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase, supabaseConfigurado } from "@/lib/supabase";
import { useSessao } from "@/lib/sessao";
import { DISTRITOS, Imovel, TIPOS, TipoImovel } from "@/lib/tipos";
import AuthModal from "@/components/AuthModal";
import BarraTopo from "@/components/BarraTopo";
import FormImovel from "@/components/FormImovel";
import Ficha from "@/components/Ficha";
import type { Regiao } from "@/components/Mapa";

const Mapa = dynamic(() => import("@/components/Mapa"), {
  ssr: false,
  loading: () => <div className="mapa a-carregar">A carregar o mapa…</div>,
});

function Mais() {
  return (
    <svg width="22" height="22" viewBox="0 0 26 26" aria-hidden="true">
      <rect x="10" y="0" width="6" height="26" />
      <rect x="0" y="10" width="26" height="6" />
    </svg>
  );
}

export default function Inicio() {
  const { user, perfil } = useSessao();
  const [imoveis, setImoveis] = useState<Imovel[]>([]);
  const [filtroTipo, setFiltroTipo] = useState<TipoImovel | "">("");
  const [filtroDistrito, setFiltroDistrito] = useState("");
  const [regiao, setRegiao] = useState<Regiao>("continente");
  const [aberto, setAberto] = useState<Imovel | null>(null);
  const [aAdicionar, setAAdicionar] = useState(false);
  const [ponto, setPonto] = useState<[number, number] | null>(null);
  const [login, setLogin] = useState<false | "entrar" | "registar">(false);

  const carregar = useCallback(async () => {
    if (!supabaseConfigurado) return;
    const { data } = await supabase.from("imoveis").select("*").eq("estado", "aprovado");
    setImoveis((data ?? []) as Imovel[]);
  }, []);
  useEffect(() => {
    carregar();
  }, [carregar]);

  // /?ficha=<id> (vindo da lista pública) abre logo esse imóvel
  useEffect(() => {
    const id = new URLSearchParams(window.location.search).get("ficha");
    if (!id || aberto) return;
    const i = imoveis.find((x) => x.id === id);
    if (i) setAberto(i);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [imoveis]);

  const porDistrito = useMemo(
    () => imoveis.filter((i) => !filtroDistrito || i.distrito === filtroDistrito),
    [imoveis, filtroDistrito]
  );
  const visiveis = useMemo(
    () => porDistrito.filter((i) => !filtroTipo || i.tipo === filtroTipo),
    [porDistrito, filtroTipo]
  );
  const contagem = useMemo(() => {
    const c: Partial<Record<TipoImovel, number>> = {};
    porDistrito.forEach((i) => (c[i.tipo] = (c[i.tipo] ?? 0) + 1));
    return c;
  }, [porDistrito]);

  function comecarAdicionar() {
    if (!user) return setLogin("entrar");
    setAberto(null);
    setPonto(null);
    setAAdicionar(true);
  }

  return (
    <div className="pagina">
    <BarraTopo
      ativo="mapa"
      logado={!!user}
      nome={perfil?.nome_publico ?? (user?.user_metadata?.full_name as string | undefined) ?? user?.email?.split("@")[0]}
      moderador={perfil?.moderador}
      onEntrar={setLogin}
    />
    <main className="app">
      <aside className="cartaz">
        <div className="cartaz-topo">
          <span className="rotulo">Inventário popular · Nº 001</span>
        </div>
        <h1 className="titulo">
          <span>Expro<span className="hifen">-</span></span>
          <span>pria</span>
          <span className="titulo-pcp">PCP</span>
        </h1>
        <div className="cartaz-fundo">
          <p className="contador">
            <strong>{imoveis.length}</strong>
            <span>
              imóveis do partido
              <br />
              assinalados pelo povo
            </span>
          </p>
          <Link href="/imoveis" className="ligacao-lista">Ver a lista de todos os imóveis →</Link>
          <button className="cta" onClick={comecarAdicionar} disabled={aAdicionar}>
            <span>Assinalar um imóvel</span>
            <Mais />
          </button>
        </div>
      </aside>

      <section className="area-mapa">
        {!supabaseConfigurado && (
          <p className="faixa">Falta configurar o Supabase: copia .env.example para .env.local e preenche as chaves.</p>
        )}

        <Mapa
          imoveis={visiveis}
          selecionado={aberto?.id ?? null}
          regiao={regiao}
          aEscolher={aAdicionar}
          novoPonto={ponto}
          onEscolher={(lat, lng) => setPonto([lat, lng])}
          onAbrir={(i) => !aAdicionar && setAberto(i)}
        />

        {!aAdicionar && (
        <div className="filtros">
          <div className="chips">
            <button className={filtroTipo === "" ? "ativo" : ""} onClick={() => setFiltroTipo("")}>
              Tudo {porDistrito.length}
            </button>
            {(Object.keys(TIPOS) as TipoImovel[])
              .filter((t) => contagem[t])
              .map((t) => (
                <button key={t} className={filtroTipo === t ? "ativo" : ""} onClick={() => setFiltroTipo(t)}>
                  {TIPOS[t].plural} {contagem[t]}
                </button>
              ))}
          </div>
          <div className="chips">
            <select value={filtroDistrito} onChange={(e) => setFiltroDistrito(e.target.value)} aria-label="Distrito">
              <option value="">Todos os distritos</option>
              {DISTRITOS.map((d) => <option key={d}>{d}</option>)}
            </select>
            {(["continente", "acores", "madeira"] as Regiao[]).map((r) => (
              <button key={r} className={regiao === r ? "ativo" : ""} onClick={() => setRegiao(r)}>
                {{ continente: "Continente", acores: "Açores", madeira: "Madeira" }[r]}
              </button>
            ))}
          </div>
        </div>
        )}


        {!aAdicionar && (
          <button className="cta cta-movel" onClick={comecarAdicionar}>
            <span>Assinalar um imóvel</span>
            <Mais />
          </button>
        )}

        {aAdicionar && user && (
          <FormImovel
            ponto={ponto}
            onPonto={(lat, lng) => setPonto([lat, lng])}
            userId={user.id}
            onCancelar={() => { setAAdicionar(false); setPonto(null); }}
            onCriado={() => { setAAdicionar(false); setPonto(null); carregar(); }}
          />
        )}

        {aberto && (
          <Ficha
            key={aberto.id}
            imovel={aberto}
            userId={user?.id ?? null}
            moderador={Boolean(perfil?.moderador)}
            onFechar={() => setAberto(null)}
            onRemovido={() => { setAberto(null); carregar(); }}
            onPedirLogin={() => setLogin("entrar")}
          />
        )}
      </section>

      {login && <AuthModal inicial={login} onFechar={() => setLogin(false)} />}
    </main>
    </div>
  );
}

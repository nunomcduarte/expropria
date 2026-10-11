"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { supabase, supabaseConfigurado } from "@/lib/supabase";
import { useSessao } from "@/lib/sessao";
import { DISTRITOS, Imovel, TIPOS, TipoImovel, numeroFicha } from "@/lib/tipos";

const POR_PAGINA = 20;

export default function ListaPublica() {
  const { user } = useSessao();
  const [imoveis, setImoveis] = useState<Imovel[]>([]);
  const [aCarregar, setACarregar] = useState(true);
  const [tipo, setTipo] = useState<TipoImovel | "">("");
  const [distrito, setDistrito] = useState("");
  const [mostrar, setMostrar] = useState(POR_PAGINA);

  useEffect(() => {
    if (!supabaseConfigurado) return setACarregar(false);
    supabase
      .from("imoveis")
      .select("*")
      .eq("estado", "aprovado")
      .order("numero", { ascending: false })
      .then(({ data }) => {
        setImoveis((data ?? []) as Imovel[]);
        setACarregar(false);
      });
  }, []);

  const porDistrito = useMemo(
    () => imoveis.filter((i) => !distrito || i.distrito === distrito),
    [imoveis, distrito]
  );
  const visiveis = useMemo(() => porDistrito.filter((i) => !tipo || i.tipo === tipo), [porDistrito, tipo]);
  const contagem = useMemo(() => {
    const c: Partial<Record<TipoImovel, number>> = {};
    porDistrito.forEach((i) => (c[i.tipo] = (c[i.tipo] ?? 0) + 1));
    return c;
  }, [porDistrito]);

  return (
    <main className="app lista-app">
      <aside className="cartaz">
        <div className="cartaz-topo">
          <span className="rotulo">Inventário popular</span>
          <nav className="sessao">
            <Link href="/">{user ? "Mapa" : "Entrar"} →</Link>
          </nav>
        </div>
        <h1 className="titulo lista-titulo">
          <span>Todos os</span>
          <span>Imóveis</span>
          <span className="titulo-pcp">do PCP</span>
        </h1>
        <div className="cartaz-fundo">
          <p className="contador">
            <strong>{imoveis.length}</strong>
            <span>
              assinalados pelo povo,
              <br />
              visíveis sem conta
            </span>
          </p>
          <Link href="/" className="cta">
            <span>Ver no mapa</span>
            <span aria-hidden="true" className="seta">→</span>
          </Link>
        </div>
      </aside>

      <section className="lista">
        <div className="chips lista-filtros">
          <button className={tipo === "" ? "ativo" : ""} onClick={() => { setTipo(""); setMostrar(POR_PAGINA); }}>
            Tudo {porDistrito.length}
          </button>
          {(Object.keys(TIPOS) as TipoImovel[])
            .filter((t) => contagem[t])
            .map((t) => (
              <button key={t} className={tipo === t ? "ativo" : ""} onClick={() => { setTipo(t); setMostrar(POR_PAGINA); }}>
                {TIPOS[t].plural} {contagem[t]}
              </button>
            ))}
          <select
            value={distrito}
            onChange={(e) => { setDistrito(e.target.value); setTipo(""); setMostrar(POR_PAGINA); }}
            aria-label="Distrito"
          >
            <option value="">Todos os distritos</option>
            {DISTRITOS.map((d) => <option key={d}>{d}</option>)}
          </select>
        </div>

        {aCarregar ? (
          <p className="lista-vazia">A carregar…</p>
        ) : visiveis.length === 0 ? (
          <p className="lista-vazia">Ainda não há imóveis assinalados{distrito || tipo ? " com este filtro" : ""}.</p>
        ) : (
          <ul className="linhas">
            {visiveis.slice(0, mostrar).map((i) => (
              <li key={i.id}>
                <Link href={`/?ficha=${i.id}`} className="linha">
                  <span className="l-num">Nº {numeroFicha(i.numero)}</span>
                  <span className="l-titulo">
                    <strong>{i.titulo}</strong>
                    {i.morada && <small>{i.morada}</small>}
                  </span>
                  <span className="l-local">{i.concelho} · {i.distrito}</span>
                  <span className="l-tipo">{TIPOS[i.tipo].nome}</span>
                  <span className="l-seta" aria-hidden="true">→</span>
                </Link>
              </li>
            ))}
          </ul>
        )}

        {visiveis.length > mostrar && (
          <button className="mostrar-mais" onClick={() => setMostrar((m) => m + POR_PAGINA)}>Mostrar mais</button>
        )}
      </section>
    </main>
  );
}

"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { supabase, supabaseConfigurado } from "@/lib/supabase";
import { useSessao } from "@/lib/sessao";
import { DISTRITOS, Imovel, TIPOS, TipoImovel, numeroFicha } from "@/lib/tipos";

const POR_PAGINA = 12;
type Ordem = "recentes" | "antigos" | "nome";
type Vista = "grelha" | "lista";

export default function ListaPublica() {
  const { user } = useSessao();
  const [imoveis, setImoveis] = useState<Imovel[]>([]);
  const [capas, setCapas] = useState<Record<string, string>>({}); // imovel_id -> URL da 1.ª foto
  const [comFoto, setComFoto] = useState<Set<string>>(new Set());
  const [aCarregar, setACarregar] = useState(true);
  const [vista, setVista] = useState<Vista>("grelha");
  const [pesquisa, setPesquisa] = useState("");
  const [tipo, setTipo] = useState<TipoImovel | "">("");
  const [distrito, setDistrito] = useState("");
  const [concelho, setConcelho] = useState("");
  const [soComFotos, setSoComFotos] = useState(false);
  const [ordem, setOrdem] = useState<Ordem>("recentes");
  const [painel, setPainel] = useState(false);
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
    // quais os imóveis com fotos (para o filtro "só com fotos")
    supabase
      .from("fotos")
      .select("imovel_id")
      .eq("estado", "aprovado")
      .then(({ data }) => setComFoto(new Set((data ?? []).map((f) => f.imovel_id as string))));
  }, []);

  const base = useMemo(() => {
    const q = pesquisa.trim().toLowerCase();
    return imoveis.filter(
      (i) =>
        (!distrito || i.distrito === distrito) &&
        (!concelho || i.concelho === concelho) &&
        (!soComFotos || comFoto.has(i.id)) &&
        (!q || `${i.titulo} ${i.morada ?? ""} ${i.concelho}`.toLowerCase().includes(q))
    );
  }, [imoveis, distrito, concelho, soComFotos, comFoto, pesquisa]);

  const visiveis = useMemo(() => {
    const l = base.filter((i) => !tipo || i.tipo === tipo);
    if (ordem === "antigos") l.sort((a, b) => a.numero - b.numero);
    else if (ordem === "nome") l.sort((a, b) => a.titulo.localeCompare(b.titulo, "pt"));
    else l.sort((a, b) => b.numero - a.numero);
    return l;
  }, [base, tipo, ordem]);

  const contagem = useMemo(() => {
    const c: Partial<Record<TipoImovel, number>> = {};
    base.forEach((i) => (c[i.tipo] = (c[i.tipo] ?? 0) + 1));
    return c;
  }, [base]);

  const concelhos = useMemo(
    () => [...new Set(imoveis.filter((i) => !distrito || i.distrito === distrito).map((i) => i.concelho))].sort((a, b) => a.localeCompare(b, "pt")),
    [imoveis, distrito]
  );

  const pagina = visiveis.slice(0, mostrar);

  // URLs assinados (1 h) só da 1.ª foto aprovada dos cartões visíveis; a política do bucket permite-o a visitantes sem conta
  useEffect(() => {
    const falta = pagina.map((i) => i.id).filter((id) => !(id in capas));
    if (falta.length === 0 || !supabaseConfigurado) return;
    (async () => {
      const { data: fotos } = await supabase
        .from("fotos")
        .select("imovel_id, caminho, criada_em")
        .in("imovel_id", falta)
        .eq("estado", "aprovado")
        .order("criada_em");
      const primeira: Record<string, string> = {};
      (fotos ?? []).forEach((f) => { if (!(f.imovel_id in primeira)) primeira[f.imovel_id] = f.caminho; });
      const ids = Object.keys(primeira);
      const { data: urls } = ids.length
        ? await supabase.storage.from("fotos").createSignedUrls(ids.map((id) => primeira[id]), 3600)
        : { data: [] };
      const novo: Record<string, string> = {};
      falta.forEach((id) => (novo[id] = ""));
      ids.forEach((id, k) => (novo[id] = urls?.[k]?.signedUrl ?? ""));
      setCapas((c) => ({ ...c, ...novo }));
    })();
  }, [pagina, capas]);

  const nFiltros = (tipo ? 1 : 0) + (distrito ? 1 : 0) + (concelho ? 1 : 0) + (soComFotos ? 1 : 0);
  const reset = () => setMostrar(POR_PAGINA);
  const limpar = () => { setTipo(""); setDistrito(""); setConcelho(""); setSoComFotos(false); setPesquisa(""); reset(); };

  const filtros = (
    <>
      <div className="f-grupo">
        <span className="f-rotulo">Tipo</span>
        <div className="chips">
          <button className={tipo === "" ? "ativo" : ""} onClick={() => { setTipo(""); reset(); }}>Tudo {base.length}</button>
          {(Object.keys(TIPOS) as TipoImovel[]).filter((t) => contagem[t]).map((t) => (
            <button key={t} className={tipo === t ? "ativo" : ""} onClick={() => { setTipo(t); reset(); }}>
              {TIPOS[t].plural} {contagem[t]}
            </button>
          ))}
        </div>
      </div>
      <div className="f-grupo">
        <span className="f-rotulo">Local</span>
        <div className="chips">
          <select value={distrito} onChange={(e) => { setDistrito(e.target.value); setConcelho(""); setTipo(""); reset(); }} aria-label="Distrito">
            <option value="">Todos os distritos</option>
            {DISTRITOS.map((d) => <option key={d}>{d}</option>)}
          </select>
          <select value={concelho} onChange={(e) => { setConcelho(e.target.value); reset(); }} aria-label="Concelho">
            <option value="">Todos os concelhos</option>
            {concelhos.map((c) => <option key={c}>{c}</option>)}
          </select>
          <button className={soComFotos ? "ativo" : ""} onClick={() => { setSoComFotos(!soComFotos); reset(); }}>
            Com fotos {soComFotos ? "☑" : "☐"}
          </button>
        </div>
        {nFiltros > 0 && <button className="f-limpar" onClick={limpar}>Limpar filtros</button>}
      </div>
    </>
  );

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
        <div className="l-barra">
          <label className="l-pesquisa">
            <span aria-hidden="true">⌕</span>
            <input value={pesquisa} onChange={(e) => { setPesquisa(e.target.value); reset(); }} placeholder="Pesquisar por nome ou morada" />
          </label>
          <label className="l-ordenar">
            <span>Ordenar</span>
            <select value={ordem} onChange={(e) => setOrdem(e.target.value as Ordem)}>
              <option value="recentes">Mais recentes</option>
              <option value="antigos">Mais antigos</option>
              <option value="nome">Nome A–Z</option>
            </select>
          </label>
          <div className="l-vista" role="group" aria-label="Vista">
            <button className={vista === "grelha" ? "ativo" : ""} onClick={() => setVista("grelha")}>Grelha</button>
            <button className={vista === "lista" ? "ativo" : ""} onClick={() => setVista("lista")}>Lista</button>
          </div>
          <button className="l-filtros-btn" onClick={() => setPainel(true)}>
            Filtros{nFiltros > 0 && <b>{nFiltros}</b>}
          </button>
        </div>

        <div className="l-menu-filtros">{filtros}</div>

        <div className="l-resumo">
          <h2>{visiveis.length} {visiveis.length === 1 ? "imóvel" : "imóveis"}</h2>
          {visiveis.length > 0 && <span>a mostrar 1–{Math.min(mostrar, visiveis.length)}</span>}
        </div>

        {aCarregar ? (
          <p className="lista-vazia">A carregar…</p>
        ) : visiveis.length === 0 ? (
          <p className="lista-vazia">Ainda não há imóveis assinalados{nFiltros || pesquisa ? " com estes filtros" : ""}.</p>
        ) : vista === "grelha" ? (
          <ul className="grelha">
            {pagina.map((i) => (
              <li key={i.id}>
                <Link href={`/?ficha=${i.id}`} className="cartao">
                  <div className={`c-foto${capas[i.id] ? "" : " sem"}`}>
                    {capas[i.id] ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={capas[i.id]} alt={i.titulo} loading="lazy" />
                    ) : (
                      <span>{i.id in capas ? "Sem foto" : ""}</span>
                    )}
                    <em className="c-num">Nº {numeroFicha(i.numero)}</em>
                    <em className="c-tipo">{TIPOS[i.tipo].nome}</em>
                  </div>
                  <strong>{i.titulo}</strong>
                  {i.morada && <small>{i.morada}</small>}
                  <span className="c-local">{i.concelho} · {i.distrito}</span>
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <ul className="linhas">
            {pagina.map((i) => (
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

      {painel && (
        <div className="f-fundo" onClick={() => setPainel(false)}>
          <div className="f-painel" onClick={(e) => e.stopPropagation()} role="dialog" aria-label="Filtros">
            <div className="f-topo">
              <h2>Filtros</h2>
              <button onClick={() => setPainel(false)}>Fechar ✕</button>
            </div>
            {filtros}
            <button className="f-ver" onClick={() => setPainel(false)}>
              <span>Ver {visiveis.length} {visiveis.length === 1 ? "imóvel" : "imóveis"}</span>
              <span aria-hidden="true">→</span>
            </button>
          </div>
        </div>
      )}
    </main>
  );
}

"use client";

import { useMemo, useState } from "react";
import { DadosAdmin, contar, desde, haQuanto, porSemana } from "@/lib/admin";
import { MOTIVOS_DENUNCIA, TIPOS, TipoImovel, numeroFicha } from "@/lib/tipos";

const PERIODOS = [
  { nome: "7 dias", dias: 7 },
  { nome: "30 dias", dias: 30 },
  { nome: "Tudo", dias: null },
] as const;

function Barras({ linhas, max }: { linhas: [string, number][]; max: number }) {
  return (
    <div className="barras">
      {linhas.map(([nome, n]) => (
        <div key={nome} className="barra">
          <span className="barra-nome">{nome}</span>
          <span className="barra-trilho"><span style={{ width: `${(n / max) * 100}%` }} /></span>
          <strong>{n}</strong>
        </div>
      ))}
    </div>
  );
}

export default function Painel({ dados, irPara }: { dados: DadosAdmin; irPara: (s: "denuncias" | "imoveis") => void }) {
  const [periodo, setPeriodo] = useState<(typeof PERIODOS)[number]>(PERIODOS[1]);
  const { imoveis, fotos, perfis, denuncias } = dados;

  const v = useMemo(() => {
    const t0 = desde(periodo.dias);
    const recente = (d: string) => new Date(d).getTime() >= t0;
    const publicados = imoveis.filter((i) => i.estado === "aprovado");
    const fotosVisiveis = fotos.filter((f) => f.estado === "aprovado");
    const abertas = denuncias.filter((d) => !d.resolvida);
    const noPeriodo = publicados.filter((i) => recente(i.criado_em));
    const fotosPeriodo = fotosVisiveis.filter((f) => recente(f.criada_em));

    const nomes = new Map(perfis.map((p) => [p.id, p.nome_publico]));
    const porImovel = new Map(imoveis.map((i) => [i.id, i]));

    // Mais ativos: fichas + fotos no período
    const ativos = new Map<string, { fichas: number; fotos: number }>();
    for (const i of noPeriodo) if (i.criado_por) {
      const a = ativos.get(i.criado_por) ?? { fichas: 0, fotos: 0 }; a.fichas++; ativos.set(i.criado_por, a);
    }
    for (const f of fotosPeriodo) if (f.enviada_por) {
      const a = ativos.get(f.enviada_por) ?? { fichas: 0, fotos: 0 }; a.fotos++; ativos.set(f.enviada_por, a);
    }
    const topo = [...ativos.entries()]
      .sort((a, b) => b[1].fichas - a[1].fichas || b[1].fotos - a[1].fotos)
      .slice(0, 5);

    // Últimas entradas: fichas, fotos (agrupadas por imóvel e autor) e denúncias
    type Entrada = { quando: string; texto: string; quem: string; alerta?: boolean };
    const entradas: Entrada[] = [];
    for (const i of imoveis.slice(0, 8))
      entradas.push({ quando: i.criado_em, texto: `Nova ficha nº ${numeroFicha(i.numero)} · ${i.titulo}`, quem: nomes.get(i.criado_por ?? "") ?? "?" });
    const grupos: { imovel: string; autor: string | null; n: number; quando: string }[] = [];
    for (const f of fotos.slice(0, 40)) {
      const g = grupos.at(-1);
      if (g && g.imovel === f.imovel_id && g.autor === f.enviada_por) g.n++;
      else grupos.push({ imovel: f.imovel_id, autor: f.enviada_por, n: 1, quando: f.criada_em });
    }
    for (const g of grupos.slice(0, 8)) {
      const i = porImovel.get(g.imovel);
      entradas.push({ quando: g.quando, texto: `${g.n} foto${g.n > 1 ? "s" : ""} em nº ${i ? numeroFicha(i.numero) : "?"} · ${i?.titulo ?? ""}`, quem: nomes.get(g.autor ?? "") ?? "?" });
    }
    for (const d of denuncias.slice(0, 8)) {
      const i = porImovel.get(d.imovel_id ?? "");
      entradas.push({ quando: d.criada_em, texto: `Denúncia${i ? ` em nº ${numeroFicha(i.numero)}` : " de foto"} · ${MOTIVOS_DENUNCIA[d.motivo].toLowerCase()}`, quem: "anónimo ou camarada", alerta: d.motivo === "dados_pessoais" && !d.resolvida });
    }
    entradas.sort((a, b) => b.quando.localeCompare(a.quando));

    const tipos = contar(noPeriodo, (i) => TIPOS[i.tipo as TipoImovel]?.plural);
    const distritos = contar(noPeriodo, (i) => i.distrito.replace("Região Autónoma d", "R. A. d"));
    const distritosTopo: [string, number][] = distritos.slice(0, 6);
    if (distritos.length > 6) {
      const resto = distritos.slice(6);
      distritosTopo.push([`Outros (${resto.length})`, resto.reduce((s, [, n]) => s + n, 0)]);
    }

    return {
      publicados: publicados.length,
      novos: noPeriodo.length,
      fotos: fotosVisiveis.length,
      fotosNovas: fotosPeriodo.length,
      camaradas: perfis.length,
      camaradasNovos: perfis.filter((p) => recente(p.criado_em)).length,
      abertas: abertas.length,
      urgentes: abertas.filter((d) => d.motivo === "dados_pessoais").length,
      removidosImoveis: imoveis.filter((i) => i.estado === "rejeitado").length,
      removidasFotos: fotos.filter((f) => f.estado === "rejeitado").length,
      semanas: porSemana(publicados),
      tipos, distritos: distritosTopo,
      topo: topo.map(([id, a]) => ({ nome: nomes.get(id) ?? "?", ...a })),
      entradas: entradas.slice(0, 5),
    };
  }, [imoveis, fotos, perfis, denuncias, periodo]);

  const quando = periodo.dias === null ? "desde o início" : `nos últimos ${periodo.dias} dias`;
  const maxSemana = Math.max(1, ...v.semanas.map((s) => s.total));
  const dataCurta = (t: number) => new Date(t).toLocaleDateString("pt-PT", { day: "numeric", month: "short" }).replace(".", "").toUpperCase();

  return (
    <>
      <div className="adm-cabecalho">
        <h1>Painel de gestão</h1>
        <div className="segmentos" role="group" aria-label="Período">
          {PERIODOS.map((p) => (
            <button key={p.nome} className={p === periodo ? "ativo" : ""} onClick={() => setPeriodo(p)}>{p.nome}</button>
          ))}
        </div>
      </div>

      <div className="numeros">
        <div className="numero"><span className="rotulo">Imóveis publicados</span><strong>{v.publicados}</strong><small>+{v.novos} {quando}</small></div>
        <div className="numero"><span className="rotulo">Fotos</span><strong>{v.fotos}</strong><small>+{v.fotosNovas} {quando}</small></div>
        <div className="numero"><span className="rotulo">Camaradas registados</span><strong>{v.camaradas}</strong><small>+{v.camaradasNovos} {quando}</small></div>
        <button className="numero alerta" onClick={() => irPara("denuncias")}>
          <span className="rotulo">Denúncias abertas</span><strong>{v.abertas}</strong>
          <small>{v.urgentes ? `${v.urgentes} de dados pessoais →` : "Ver todas →"}</small>
        </button>
        <button className="numero" onClick={() => irPara("imoveis")}>
          <span className="rotulo">Removidos</span><strong>{v.removidosImoveis + v.removidasFotos}</strong>
          <small>{v.removidosImoveis} imóve{v.removidosImoveis === 1 ? "l" : "is"} · {v.removidasFotos} foto{v.removidasFotos === 1 ? "" : "s"}</small>
        </button>
      </div>

      <div className="grelha grelha-2-1">
        <section className="bloco">
          <header><h2>Fichas novas por semana</h2><small>últimas 12 semanas</small></header>
          <div className="colunas" role="img" aria-label={`Fichas por semana: ${v.semanas.map((s) => s.total).join(", ")}`}>
            {v.semanas.map((s, k) => (
              <span key={k} className={k === v.semanas.length - 1 ? "atual" : ""} style={{ height: `${(s.total / maxSemana) * 100}%` }} title={`${dataCurta(s.inicio)}: ${s.total}`} />
            ))}
          </div>
          <div className="eixo">
            <span>{dataCurta(v.semanas[0].inicio)}</span>
            <span>{dataCurta(v.semanas[4].inicio)}</span>
            <span>{dataCurta(v.semanas[8].inicio)}</span>
            <strong>Esta semana · {v.semanas.at(-1)!.total}</strong>
          </div>
        </section>
        <section className="bloco">
          <header><h2>Por tipo</h2></header>
          {v.tipos.length ? <Barras linhas={v.tipos} max={v.tipos[0][1]} /> : <p className="vazio">Nada {quando}.</p>}
        </section>
      </div>

      <div className="grelha grelha-3">
        <section className="bloco">
          <header><h2>Por distrito</h2></header>
          {v.distritos.length ? <Barras linhas={v.distritos} max={Math.max(...v.distritos.map((d) => d[1]))} /> : <p className="vazio">Nada {quando}.</p>}
        </section>
        <section className="bloco">
          <header><h2>Mais ativos</h2></header>
          {v.topo.length === 0 && <p className="vazio">Ninguém {quando}.</p>}
          <ol className="lista-linhas">
            {v.topo.map((a, k) => (
              <li key={a.nome + k}>
                <span><b>{String(k + 1).padStart(2, "0")}</b> {a.nome}</span>
                <span>{a.fichas} ficha{a.fichas === 1 ? "" : "s"} · {a.fotos} foto{a.fotos === 1 ? "" : "s"}</span>
              </li>
            ))}
          </ol>
        </section>
        <section className="bloco">
          <header><h2>Últimas entradas</h2></header>
          {v.entradas.length === 0 && <p className="vazio">Ainda nada.</p>}
          <ul className="lista-linhas entradas">
            {v.entradas.map((e, k) => (
              <li key={k} className={e.alerta ? "alerta" : ""}>
                <b>{e.texto}</b>
                <small>{e.quem} · {haQuanto(e.quando)}</small>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </>
  );
}

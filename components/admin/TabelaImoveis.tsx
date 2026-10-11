"use client";

import { useMemo, useState } from "react";
import { DadosAdmin, ImovelAdmin, haQuanto } from "@/lib/admin";
import { TIPOS, numeroFicha } from "@/lib/tipos";

const POR_PAGINA = 20;
const sem = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

export default function TabelaImoveis({ dados, mudarEstado }: {
  dados: DadosAdmin;
  mudarEstado: (i: ImovelAdmin, estado: "aprovado" | "rejeitado") => void;
}) {
  const [busca, setBusca] = useState("");
  const [estado, setEstado] = useState<"todos" | "aprovado" | "rejeitado" | "com_denuncia">("todos");
  const [pagina, setPagina] = useState(0);

  const { fotosPor, abertasPor } = useMemo(() => {
    const fotosPor = new Map<string, number>();
    for (const f of dados.fotos) if (f.estado === "aprovado") fotosPor.set(f.imovel_id, (fotosPor.get(f.imovel_id) ?? 0) + 1);
    const abertasPor = new Map<string, number>();
    for (const d of dados.denuncias) if (!d.resolvida && d.imovel_id) abertasPor.set(d.imovel_id, (abertasPor.get(d.imovel_id) ?? 0) + 1);
    return { fotosPor, abertasPor };
  }, [dados]);

  const lista = useMemo(() => {
    const q = sem(busca.trim());
    return dados.imoveis.filter((i) => {
      if (estado === "com_denuncia" ? !abertasPor.get(i.id) : estado !== "todos" && i.estado !== estado) return false;
      return !q || sem(`${i.titulo} ${i.concelho} ${i.distrito} ${numeroFicha(i.numero)}`).includes(q);
    });
  }, [dados.imoveis, busca, estado, abertasPor]);

  const paginas = Math.max(1, Math.ceil(lista.length / POR_PAGINA));
  const p = Math.min(pagina, paginas - 1);
  const visiveis = lista.slice(p * POR_PAGINA, (p + 1) * POR_PAGINA);

  return (
    <section className="todos">
      <div className="adm-cabecalho">
        <h2>Todos os imóveis · {lista.length}</h2>
        <div className="procura">
          <input type="search" placeholder="Procurar título, concelho, nº…" value={busca}
            onChange={(e) => { setBusca(e.target.value); setPagina(0); }} aria-label="Procurar imóveis" />
          <select value={estado} onChange={(e) => { setEstado(e.target.value as typeof estado); setPagina(0); }} aria-label="Estado">
            <option value="todos">Estado: todos</option>
            <option value="aprovado">Publicados</option>
            <option value="rejeitado">Removidos</option>
            <option value="com_denuncia">Com denúncia aberta</option>
          </select>
        </div>
      </div>
      <div className="tabela-rolo">
        <table className="tabela">
          <thead>
            <tr><th>Nº</th><th>Título</th><th>Tipo</th><th>Concelho</th><th>Fotos</th><th>Denúnc.</th><th>Estado</th><th>Criado</th><th /></tr>
          </thead>
          <tbody>
            {visiveis.map((i) => {
              const abertas = abertasPor.get(i.id) ?? 0;
              const removido = i.estado === "rejeitado";
              return (
                <tr key={i.id} className={removido ? "removido" : abertas ? "com-denuncia" : ""}>
                  <td><b>{numeroFicha(i.numero)}</b></td>
                  <td className="t-titulo">{i.titulo}</td>
                  <td>{TIPOS[i.tipo]?.nome ?? i.tipo}</td>
                  <td>{i.concelho}</td>
                  <td>{fotosPor.get(i.id) ?? 0}</td>
                  <td className={abertas ? "vermelho" : ""}>{abertas ? `${abertas} aberta${abertas > 1 ? "s" : ""}` : 0}</td>
                  <td><span className={`etiqueta ${removido ? "cheia" : ""}`}>{removido ? "Removido" : "Publicado"}</span></td>
                  <td className="t-data">{haQuanto(i.criado_em)}</td>
                  <td className="t-acao">
                    <button className="ligacao" onClick={() => {
                      if (removido || confirm(`Remover a ficha nº ${numeroFicha(i.numero)} do mapa?`))
                        mudarEstado(i, removido ? "aprovado" : "rejeitado");
                    }}>{removido ? "Repor" : "Remover"}</button>
                  </td>
                </tr>
              );
            })}
            {visiveis.length === 0 && <tr><td colSpan={9} className="vazio">Nenhum imóvel encontrado.</td></tr>}
          </tbody>
        </table>
      </div>
      <div className="paginacao">
        <small>A mostrar {lista.length ? p * POR_PAGINA + 1 : 0}–{p * POR_PAGINA + visiveis.length} de {lista.length}</small>
        <div>
          <button className="ligacao" disabled={p === 0} onClick={() => setPagina(p - 1)}>← Anterior</button>
          <button className="ligacao" disabled={p >= paginas - 1} onClick={() => setPagina(p + 1)}>Seguinte →</button>
        </div>
      </div>
    </section>
  );
}

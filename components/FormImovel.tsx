"use client";

import { useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";
import { DISTRITOS, FONTES, TIPOS, TipoFonte, TipoImovel } from "@/lib/tipos";
import { EscolherFotos, enviarFotos } from "./EnviarFotos";
import type { FotoPreparada } from "@/lib/desfocar";

type Props = {
  ponto: [number, number] | null;
  onPonto: (lat: number, lng: number) => void;
  userId: string;
  onCancelar: () => void;
  onCriado: () => void;
};

export default function FormImovel({ ponto, onPonto, userId, onCancelar, onCriado }: Props) {
  const [titulo, setTitulo] = useState("");
  const [tipo, setTipo] = useState<TipoImovel>("centro_trabalho");
  const [descricao, setDescricao] = useState("");
  const [distrito, setDistrito] = useState("");
  const [concelho, setConcelho] = useState("");
  const [morada, setMorada] = useState("");
  const [fonteTipo, setFonteTipo] = useState<TipoFonte>("contas_partido");
  const [fonteUrl, setFonteUrl] = useState("");
  const [fonteNota, setFonteNota] = useState("");
  const [ficheiros, setFicheiros] = useState<FotoPreparada[]>([]);
  const [confirmado, setConfirmado] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [aEnviar, setAEnviar] = useState(false);
  const [aProcurar, setAProcurar] = useState(false);
  const [semResultado, setSemResultado] = useState(false);
  const daMorada = useRef(false); // o ponto veio da morada escrita: não a sobrescrever
  const temporizador = useRef<ReturnType<typeof setTimeout>>(undefined);

  // Preenche morada, concelho e distrito a partir do ponto escolhido (OpenStreetMap).
  useEffect(() => {
    if (!ponto) return;
    const ctrl = new AbortController();
    fetch(
      `https://nominatim.openstreetmap.org/reverse?format=jsonv2&accept-language=pt&lat=${ponto[0]}&lon=${ponto[1]}`,
      { signal: ctrl.signal }
    )
      .then((r) => r.json())
      .then((d) => {
        const a = d.address ?? {};
        const rua = [a.road, a.house_number].filter(Boolean).join(", ");
        const local = a.city || a.town || a.village || "";
        if (daMorada.current) daMorada.current = false;
        else setMorada([rua, a.postcode, local].filter(Boolean).join(" · "));
        setConcelho(a.municipality || a.city || a.town || a.county || "");
        const valores = Object.values(a).map(String);
        const d1 =
          DISTRITOS.find((x) => valores.some((v) => v === x || v === `Distrito de ${x}`)) ??
          (a.state === "Açores" ? DISTRITOS[18] : a.state === "Madeira" ? DISTRITOS[19] : "");
        if (d1) setDistrito(d1);
      })
      .catch(() => {});
    return () => ctrl.abort();
  }, [ponto]);

  // Procura a morada escrita e põe o pin no mapa.
  async function procurar(texto: string) {
    if (texto.trim().length < 4) return;
    setAProcurar(true);
    setSemResultado(false);
    try {
      const r = await fetch(
        `https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&countrycodes=pt&accept-language=pt&q=${encodeURIComponent(texto)}`
      );
      const d = await r.json();
      if (d[0]) {
        daMorada.current = true;
        onPonto(parseFloat(d[0].lat), parseFloat(d[0].lon));
      } else setSemResultado(true);
    } catch {
      setSemResultado(true);
    } finally {
      setAProcurar(false);
    }
  }

  function escreverMorada(v: string) {
    setMorada(v);
    clearTimeout(temporizador.current);
    temporizador.current = setTimeout(() => procurar(v), 1200);
  }

  async function submeter(e: React.FormEvent) {
    e.preventDefault();
    if (!ponto) return setErro("Escolhe primeiro o local no mapa.");
    if (ficheiros.length && !confirmado) return setErro("Confirma que as fotos foram tiradas da via pública.");
    setErro(null);
    setAEnviar(true);
    try {
      const { data, error } = await supabase
        .from("imoveis")
        .insert({
          titulo: titulo.trim(),
          tipo,
          descricao: descricao.trim() || null,
          distrito,
          concelho: concelho.trim(),
          morada: morada.trim() || null,
          lat: ponto[0],
          lng: ponto[1],
          fonte_tipo: fonteTipo,
          fonte_url: fonteUrl.trim() || null,
          fonte_nota: fonteNota.trim(),
          criado_por: userId,
        })
        .select("id")
        .single();
      if (error) throw error;
      if (ficheiros.length) await enviarFotos(data.id, userId, ficheiros);
      onCriado();
    } catch (err) {
      setErro("Não foi possível guardar: " + (err as Error).message);
    } finally {
      setAEnviar(false);
    }
  }

  return (
    <form className="painel formulario" onSubmit={submeter}>
      <header className="painel-topo">
        <span>Nova ficha</span>
        <button type="button" className="fechar" onClick={onCancelar} aria-label="Fechar">×</button>
      </header>
      <div className="painel-corpo">
      <h2>Assinalar imóvel</h2>
      <p className={ponto ? "ok" : "dica"}>
        {ponto ? "Pin colocado. Arrasta-o ou clica noutro ponto do mapa para ajustar." : "Escreve a morada ou clica no mapa: o pin é colocado automaticamente."}
      </p>

      <label>Nome<input required minLength={3} maxLength={120} value={titulo} onChange={(e) => setTitulo(e.target.value)} placeholder="Ex.: Centro de Trabalho de Alcântara" /></label>
      <div className="linha">
        <label>Tipo
          <select value={tipo} onChange={(e) => setTipo(e.target.value as TipoImovel)}>
            {Object.entries(TIPOS).map(([k, v]) => <option key={k} value={k}>{v.nome}</option>)}
          </select>
        </label>
      </div>
      <div className="linha">
        <label>Distrito
          <select required value={distrito} onChange={(e) => setDistrito(e.target.value)}>
            <option value="">Escolher…</option>
            {DISTRITOS.map((d) => <option key={d}>{d}</option>)}
          </select>
        </label>
        <label>Concelho<input required value={concelho} onChange={(e) => setConcelho(e.target.value)} /></label>
      </div>
      <label>Morada
        <input
          value={morada}
          onChange={(e) => escreverMorada(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); clearTimeout(temporizador.current); procurar(morada); } }}
          placeholder="Ex.: Rua Soeiro Pereira Gomes 3, Lisboa"
        />
        {aProcurar && <small className="dica">A procurar no mapa…</small>}
        {semResultado && <small className="dica">Morada não encontrada. Clica no mapa para marcar o local.</small>}
      </label>
      <label>Descrição<textarea maxLength={2000} rows={3} value={descricao} onChange={(e) => setDescricao(e.target.value)} /></label>

      <fieldset>
        <legend>Como sabes que é do partido?</legend>
        <label>Fonte
          <select value={fonteTipo} onChange={(e) => setFonteTipo(e.target.value as TipoFonte)}>
            {Object.entries(FONTES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </label>
        <label>Link (opcional)<input type="url" value={fonteUrl} onChange={(e) => setFonteUrl(e.target.value)} placeholder="https://" /></label>
        <label>Explicação<textarea required minLength={10} rows={2} value={fonteNota} onChange={(e) => setFonteNota(e.target.value)} placeholder="Ex.: consta do anexo de imóveis das contas de 2024, pág. 37" /></label>
      </fieldset>

      <EscolherFotos ficheiros={ficheiros} setFicheiros={setFicheiros} confirmado={confirmado} setConfirmado={setConfirmado} />

      {erro && <p className="erro">{erro}</p>}
      </div>
      <div className="barra-publicar">
        <button className="primario" disabled={aEnviar || !ponto}>{aEnviar ? "A publicar…" : "Publicar no mapa"}</button>
      </div>
    </form>
  );
}

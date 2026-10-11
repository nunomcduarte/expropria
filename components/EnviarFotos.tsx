"use client";

import { useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";
import { FotoPreparada, Zona, aplicarZonas, prepararFoto } from "@/lib/desfocar";

export const MAX_FOTOS = 5;

export async function enviarFotos(imovelId: string, userId: string, fotos: FotoPreparada[]) {
  for (const f of fotos.slice(0, MAX_FOTOS)) {
    const caminho = `${userId}/${crypto.randomUUID()}.jpg`;
    const up = await supabase.storage.from("fotos").upload(caminho, f.blob, { contentType: "image/jpeg" });
    if (up.error) throw up.error;
    const ins = await supabase.from("fotos").insert({
      imovel_id: imovelId,
      caminho,
      tirada_da_via_publica: true,
    });
    if (ins.error) throw ins.error;
  }
}

export function EscolherFotos({
  ficheiros,
  setFicheiros,
  confirmado,
  setConfirmado,
}: {
  ficheiros: FotoPreparada[];
  setFicheiros: (f: FotoPreparada[]) => void;
  confirmado: boolean;
  setConfirmado: (v: boolean) => void;
}) {
  const [erro, setErro] = useState<string | null>(null);
  const [aProcessar, setAProcessar] = useState(0);
  const [aEditar, setAEditar] = useState<FotoPreparada | null>(null);

  async function escolher(lista: File[]) {
    const grandes = lista.filter((f) => f.size > 15 * 1024 * 1024);
    setErro(grandes.length ? "Há fotos com mais de 15 MB; foram ignoradas." : null);
    const validos = lista.filter((f) => f.size <= 15 * 1024 * 1024).slice(0, MAX_FOTOS);
    setFicheiros([]);
    setConfirmado(false);
    setAProcessar(validos.length);
    const prontas: FotoPreparada[] = [];
    for (const f of validos) {
      try {
        prontas.push(await prepararFoto(f));
      } catch {
        setErro("Não foi possível ler uma das fotos.");
      }
      setAProcessar((n) => n - 1);
    }
    setFicheiros(prontas);
  }

  const caras = ficheiros.reduce((s, f) => s + f.zonas.filter((z) => z.origem !== "mao").length, 0);
  const carros = ficheiros.reduce((s, f) => s + f.carros, 0);
  const semAuto = ficheiros.some((f) => !f.auto);

  return (
    <fieldset className="fotos-campo">
      <legend>Fotos (até {MAX_FOTOS})</legend>
      <input
        type="file"
        accept="image/jpeg,image/png,image/webp"
        multiple
        onChange={(e) => escolher(Array.from(e.target.files ?? []))}
      />
      {aProcessar > 0 && <p className="dica">A procurar caras para tapar… ({aProcessar})</p>}
      {ficheiros.length > 0 && (
        <>
          <div className="miniaturas">
            {ficheiros.map((f) => (
              <button type="button" key={f.id} className="miniatura" onClick={() => setAEditar(f)} title="Tapar mais zonas">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={f.url} alt="" />
                <span>Editar</span>
              </button>
            ))}
          </div>
          <p className="ok">
            {semAuto
              ? "A deteção automática não carregou. Toca em cada foto e tapa caras e matrículas à mão."
              : `${caras ? `${caras} cara${caras > 1 ? "s" : ""} tapada${caras > 1 ? "s" : ""} automaticamente.` : "Nenhuma cara encontrada."} `
                + (carros ? `Há ${carros} veículo${carros > 1 ? "s" : ""}: toca na foto e tapa as matrículas.` : "Toca numa foto para tapar mais alguma coisa.")}
          </p>
          <label className="check">
            <input type="checkbox" checked={confirmado} onChange={(e) => setConfirmado(e.target.checked)} />
            Tirei as fotos da via pública e verifiquei que caras e matrículas estão tapadas.
          </label>
        </>
      )}
      {erro && <p className="erro">{erro}</p>}
      <small>A localização GPS e outros metadados são apagados antes do envio.</small>
      {aEditar && (
        <EditorZonas
          foto={aEditar}
          onFechar={() => setAEditar(null)}
          onGuardar={async (zonas) => {
            const nova = await aplicarZonas(aEditar, zonas);
            setFicheiros(ficheiros.map((f) => (f.id === nova.id ? nova : f)));
            setAEditar(null);
          }}
        />
      )}
    </fieldset>
  );
}

// Arrasta para tapar uma zona (matrícula, cara que escapou). Toca numa zona para a destapar.
function EditorZonas({ foto, onFechar, onGuardar }: { foto: FotoPreparada; onFechar: () => void; onGuardar: (z: Zona[]) => void }) {
  const [zonas, setZonas] = useState<Zona[]>(foto.zonas);
  const [nova, setNova] = useState<Zona | null>(null);
  const area = useRef<HTMLDivElement>(null);
  const inicio = useRef<{ x: number; y: number } | null>(null);
  const [preview, setPreview] = useState(foto.url);

  // Pré-visualização ao vivo do resultado
  useEffect(() => {
    let url = "";
    let vivo = true;
    import("@/lib/desfocar").then(({ pintar }) => {
      pintar(foto.original, zonas).toBlob((b) => {
        if (!b || !vivo) return;
        url = URL.createObjectURL(b);
        setPreview(url);
      }, "image/jpeg", 0.8);
    });
    return () => { vivo = false; if (url) URL.revokeObjectURL(url); };
  }, [zonas, foto.original]);

  const ponto = (e: React.PointerEvent) => {
    const r = area.current!.getBoundingClientRect();
    return {
      x: Math.min(Math.max(0, (e.clientX - r.left) / r.width), 1) * foto.original.width,
      y: Math.min(Math.max(0, (e.clientY - r.top) / r.height), 1) * foto.original.height,
    };
  };
  const pct = (z: Zona) => ({
    left: `${(z.x / foto.original.width) * 100}%`, top: `${(z.y / foto.original.height) * 100}%`,
    width: `${(z.w / foto.original.width) * 100}%`, height: `${(z.h / foto.original.height) * 100}%`,
  });

  return (
    <div className="fundo" onClick={onFechar}>
      <div className="caixa editor" onClick={(e) => e.stopPropagation()}>
        <header className="caixa-topo">
          <span>Tapar caras e matrículas</span>
          <button type="button" className="fechar" onClick={onFechar} aria-label="Fechar">×</button>
        </header>
        <div className="caixa-corpo">
          <p className="sub">Arrasta sobre a foto para tapar uma zona. Toca num quadrado para o retirar.</p>
          <div
            ref={area}
            className="editor-area"
            style={{ aspectRatio: `${foto.original.width} / ${foto.original.height}`, width: `min(100%, calc(60dvh * ${foto.original.width / foto.original.height}))` }}
            onPointerDown={(e) => {
              if ((e.target as HTMLElement).dataset.zona) return;
              (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
              inicio.current = ponto(e);
              setNova({ ...inicio.current, w: 0, h: 0, origem: "mao" });
            }}
            onPointerMove={(e) => {
              if (!inicio.current) return;
              const p = ponto(e), i = inicio.current;
              setNova({ x: Math.min(i.x, p.x), y: Math.min(i.y, p.y), w: Math.abs(p.x - i.x), h: Math.abs(p.y - i.y), origem: "mao" });
            }}
            onPointerUp={() => {
              if (nova && nova.w > 6 && nova.h > 6) setZonas([...zonas, nova]);
              inicio.current = null;
              setNova(null);
            }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={preview} alt="" draggable={false} />
            {zonas.map((z, k) => (
              <button type="button" key={k} data-zona="1" className={`zona ${z.origem}`} style={pct(z)}
                aria-label="Retirar zona" onClick={() => setZonas(zonas.filter((_, j) => j !== k))} />
            ))}
            {nova && <span className="zona mao a-desenhar" style={pct(nova)} />}
          </div>
          <div className="editor-acoes">
            <button type="button" className="secundario" onClick={() => setZonas(zonas.slice(0, -1))} disabled={!zonas.length}>Desfazer</button>
            <button type="button" className="primario" onClick={() => onGuardar(zonas)}>Pronto · {zonas.length} zona{zonas.length === 1 ? "" : "s"}</button>
          </div>
        </div>
      </div>
    </div>
  );
}

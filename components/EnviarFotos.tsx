"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabase";
import { FotoPreparada, prepararFoto } from "@/lib/fotos";

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
}: {
  ficheiros: FotoPreparada[];
  setFicheiros: (f: FotoPreparada[]) => void;
}) {
  const [erro, setErro] = useState<string | null>(null);
  const [aProcessar, setAProcessar] = useState(0);

  async function escolher(lista: File[]) {
    const grandes = lista.filter((f) => f.size > 15 * 1024 * 1024);
    setErro(grandes.length ? "Há fotos com mais de 15 MB; foram ignoradas." : null);
    const validos = lista.filter((f) => f.size <= 15 * 1024 * 1024).slice(0, MAX_FOTOS);
    setFicheiros([]);
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

  return (
    <fieldset className="fotos-campo">
      <legend>Fotos (até {MAX_FOTOS})</legend>
      <input
        type="file"
        accept="image/jpeg,image/png,image/webp"
        multiple
        onChange={(e) => escolher(Array.from(e.target.files ?? []))}
      />
      {aProcessar > 0 && <p className="dica">A preparar fotos… ({aProcessar})</p>}
      {ficheiros.length > 0 && (
        <div className="miniaturas">
          {ficheiros.map((f) => (
            // eslint-disable-next-line @next/next/no-img-element
            <img key={f.id} src={f.url} alt="" />
          ))}
        </div>
      )}
      {erro && <p className="erro">{erro}</p>}
      <small>A localização GPS e outros metadados são apagados antes do envio.</small>
    </fieldset>
  );
}

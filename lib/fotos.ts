// Prepara a foto no browser: redesenha num canvas (apaga EXIF/GPS) e limita o tamanho.
export type FotoPreparada = {
  id: string;
  url: string;  // pré-visualização
  blob: Blob;   // o que é enviado
};

export async function prepararFoto(ficheiro: File, ladoMax = 1600): Promise<FotoPreparada> {
  const bitmap = await createImageBitmap(ficheiro, { imageOrientation: "from-image" });
  const escala = Math.min(1, ladoMax / Math.max(bitmap.width, bitmap.height));
  const c = document.createElement("canvas");
  c.width = Math.round(bitmap.width * escala);
  c.height = Math.round(bitmap.height * escala);
  c.getContext("2d")!.drawImage(bitmap, 0, 0, c.width, c.height);
  bitmap.close();
  const blob = await new Promise<Blob>((ok, falha) =>
    c.toBlob((b) => (b ? ok(b) : falha(new Error("Falha ao processar a foto"))), "image/jpeg", 0.85));
  return { id: crypto.randomUUID(), url: URL.createObjectURL(blob), blob };
}

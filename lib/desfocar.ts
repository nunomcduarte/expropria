// Desfoca caras (automático) e matrículas (marcadas à mão) antes de a foto sair do browser.
// Tudo corre localmente: os modelos e o WASM estão em /public/mediapipe.
import type { FaceDetector, ObjectDetector } from "@mediapipe/tasks-vision";

export type Zona = { x: number; y: number; w: number; h: number; origem: "cara" | "pessoa" | "mao" };

export type FotoPreparada = {
  id: string;
  original: HTMLCanvasElement; // já sem metadados e redimensionada
  zonas: Zona[];
  carros: number;              // carros detetados: lembrar de marcar matrículas
  auto: boolean;               // a deteção automática correu
  url: string;                 // pré-visualização já desfocada
  blob: Blob;                  // o que é enviado
};

const BASE = "/mediapipe";
let detetores: Promise<{ caras: FaceDetector; objetos: ObjectDetector } | null> | null = null;

function carregarDetetores() {
  detetores ??= (async () => {
    try {
      const { FilesetResolver, FaceDetector, ObjectDetector } = await import("@mediapipe/tasks-vision");
      const wasm = await FilesetResolver.forVisionTasks(BASE);
      const [caras, objetos] = await Promise.all([
        FaceDetector.createFromOptions(wasm, {
          baseOptions: { modelAssetPath: `${BASE}/blaze_face_short_range.tflite` },
          runningMode: "IMAGE",
          minDetectionConfidence: 0.5,
        }),
        ObjectDetector.createFromOptions(wasm, {
          baseOptions: { modelAssetPath: `${BASE}/efficientdet_lite0.tflite` },
          runningMode: "IMAGE",
          scoreThreshold: 0.3,
          categoryAllowlist: ["person", "car", "truck", "bus", "motorcycle"],
        }),
      ]);
      return { caras, objetos };
    } catch (e) {
      console.warn("Deteção automática indisponível", e);
      return null;
    }
  })();
  return detetores;
}

// O detetor de caras foi treinado para caras grandes; para apanhar caras pequenas
// (gente ao longe na rua) corre também em recortes ampliados da imagem.
function recortes(w: number, h: number) {
  const lista = [{ x: 0, y: 0, w, h }];
  for (const n of [2, 3]) {
    const tw = w / n, th = h / n;
    for (let i = 0; i < n * 2 - 1; i++)
      for (let j = 0; j < n * 2 - 1; j++)
        lista.push({ x: (i * tw) / 2, y: (j * th) / 2, w: tw, h: th });
  }
  return lista;
}

function detetarCaras(det: FaceDetector, img: HTMLCanvasElement): Zona[] {
  const zonas: Zona[] = [];
  const tela = document.createElement("canvas");
  for (const [k, r] of recortes(img.width, img.height).entries()) {
    const escala = Math.min(3, 640 / Math.max(r.w, r.h));
    // Nos recortes ampliados o detetor inventa caras em texturas: exigir mais certeza.
    const minimo = k === 0 ? 0.5 : 0.75;
    tela.width = Math.round(r.w * escala);
    tela.height = Math.round(r.h * escala);
    tela.getContext("2d")!.drawImage(img, r.x, r.y, r.w, r.h, 0, 0, tela.width, tela.height);
    for (const d of det.detect(tela).detections) {
      const b = d.boundingBox;
      if (!b || (d.categories[0]?.score ?? 0) < minimo) continue;
      zonas.push({ x: r.x + b.originX / escala, y: r.y + b.originY / escala, w: b.width / escala, h: b.height / escala, origem: "cara" });
    }
  }
  return zonas;
}

const area = (z: Zona) => z.w * z.h;
function sobreposicao(a: Zona, b: Zona) {
  const w = Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x);
  const h = Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y);
  return w > 0 && h > 0 ? (w * h) / Math.min(area(a), area(b)) : 0;
}
function semRepetidas(zonas: Zona[]) {
  const fica: Zona[] = [];
  for (const z of [...zonas].sort((a, b) => area(b) - area(a)))
    if (!fica.some((f) => sobreposicao(f, z) > 0.5)) fica.push(z);
  return fica;
}

// Mosaico de blocos grandes (média de cada bloco): não se consegue reverter.
export function pintar(original: HTMLCanvasElement, zonas: Zona[]) {
  const c = document.createElement("canvas");
  c.width = original.width;
  c.height = original.height;
  const ctx = c.getContext("2d", { willReadFrequently: true })!;
  ctx.drawImage(original, 0, 0);
  for (const z0 of zonas) {
    const m = z0.origem === "mao" ? 0 : 0.25; // margem à volta das caras detetadas
    const x = Math.max(0, Math.floor(z0.x - z0.w * m));
    const y = Math.max(0, Math.floor(z0.y - z0.h * m));
    const w = Math.min(c.width - x, Math.ceil(z0.w * (1 + 2 * m)));
    const h = Math.min(c.height - y, Math.ceil(z0.h * (1 + 2 * m)));
    if (w < 2 || h < 2) continue;
    const bloco = Math.max(4, Math.ceil(Math.max(w, h) / 5));
    const img = ctx.getImageData(x, y, w, h);
    const d = img.data;
    for (let by = 0; by < h; by += bloco)
      for (let bx = 0; bx < w; bx += bloco) {
        const ex = Math.min(bx + bloco, w), ey = Math.min(by + bloco, h);
        let r = 0, g = 0, b = 0, n = 0;
        for (let yy = by; yy < ey; yy++)
          for (let xx = bx; xx < ex; xx++) {
            const i = (yy * w + xx) * 4;
            r += d[i]; g += d[i + 1]; b += d[i + 2]; n++;
          }
        r /= n; g /= n; b /= n;
        for (let yy = by; yy < ey; yy++)
          for (let xx = bx; xx < ex; xx++) {
            const i = (yy * w + xx) * 4;
            d[i] = r; d[i + 1] = g; d[i + 2] = b; d[i + 3] = 255;
          }
      }
    ctx.putImageData(img, x, y);
  }
  return c;
}

const paraBlob = (c: HTMLCanvasElement) =>
  new Promise<Blob>((ok, falha) => c.toBlob((b) => (b ? ok(b) : falha(new Error("Falha ao processar a foto"))), "image/jpeg", 0.85));

export async function aplicarZonas(f: FotoPreparada, zonas: Zona[]): Promise<FotoPreparada> {
  const blob = await paraBlob(pintar(f.original, zonas));
  URL.revokeObjectURL(f.url);
  return { ...f, zonas, blob, url: URL.createObjectURL(blob) };
}

// Redesenha a imagem num canvas (o que apaga EXIF/GPS), limita o tamanho e desfoca caras.
export async function prepararFoto(ficheiro: File, ladoMax = 1600): Promise<FotoPreparada> {
  const bitmap = await createImageBitmap(ficheiro, { imageOrientation: "from-image" });
  const escala = Math.min(1, ladoMax / Math.max(bitmap.width, bitmap.height));
  const original = document.createElement("canvas");
  original.width = Math.round(bitmap.width * escala);
  original.height = Math.round(bitmap.height * escala);
  original.getContext("2d")!.drawImage(bitmap, 0, 0, original.width, original.height);
  bitmap.close();

  let zonas: Zona[] = [];
  let carros = 0;
  const det = await carregarDetetores();
  if (det) {
    zonas = detetarCaras(det.caras, original);
    for (const o of det.objetos.detect(original).detections) {
      const b = o.boundingBox;
      const cat = o.categories[0]?.categoryName;
      if (!b) continue;
      if (cat === "person") {
        // Cabeça de uma pessoa: o topo da caixa. Apanha quem está de costas ou longe demais para o detetor de caras.
        const hc = Math.min(b.height * 0.2, b.width * 0.9);
        zonas.push({ x: b.originX + b.width * 0.15, y: b.originY, w: b.width * 0.7, h: hc, origem: "pessoa" });
      } else carros++;
    }
    zonas = semRepetidas(zonas);
  }
  const base: FotoPreparada = { id: crypto.randomUUID(), original, zonas: [], carros, auto: !!det, url: "", blob: new Blob() };
  return aplicarZonas(base, zonas);
}

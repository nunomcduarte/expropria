import { supabase } from "./supabase";
import { MOTIVOS_DENUNCIA, TipoImovel } from "./tipos";

// Tudo o que o painel de gestão precisa, lido de uma vez (só moderadores veem tudo, pelo RLS).
export type ImovelAdmin = {
  id: string; numero: number; titulo: string; tipo: TipoImovel; distrito: string; concelho: string;
  estado: "pendente" | "aprovado" | "rejeitado"; criado_em: string; criado_por: string | null;
};
export type FotoAdmin = { id: string; imovel_id: string; estado: string; criada_em: string; enviada_por: string | null };
export type PerfilAdmin = { id: string; nome_publico: string; criado_em: string };
export type DenunciaResumo = {
  id: string; imovel_id: string | null; foto_id: string | null;
  motivo: keyof typeof MOTIVOS_DENUNCIA; resolvida: boolean; criada_em: string;
};
export type DadosAdmin = { imoveis: ImovelAdmin[]; fotos: FotoAdmin[]; perfis: PerfilAdmin[]; denuncias: DenunciaResumo[] };

export async function carregarDadosAdmin(): Promise<DadosAdmin> {
  const [i, f, p, d] = await Promise.all([
    supabase.from("imoveis").select("id, numero, titulo, tipo, distrito, concelho, estado, criado_em, criado_por").order("criado_em", { ascending: false }),
    supabase.from("fotos").select("id, imovel_id, estado, criada_em, enviada_por").order("criada_em", { ascending: false }),
    supabase.from("perfis").select("id, nome_publico, criado_em"),
    supabase.from("denuncias").select("id, imovel_id, foto_id, motivo, resolvida, criada_em").order("criada_em", { ascending: false }),
  ]);
  return {
    imoveis: (i.data ?? []) as ImovelAdmin[],
    fotos: (f.data ?? []) as FotoAdmin[],
    perfis: (p.data ?? []) as PerfilAdmin[],
    denuncias: (d.data ?? []) as DenunciaResumo[],
  };
}

const DIA = 86_400_000;
export const desde = (dias: number | null) => (dias === null ? 0 : Date.now() - dias * DIA);

export function haQuanto(data: string) {
  const min = Math.round((Date.now() - new Date(data).getTime()) / 60_000);
  if (min < 1) return "agora";
  if (min < 60) return `há ${min} min`;
  const h = Math.round(min / 60);
  if (h < 24) return `há ${h} h`;
  if (h < 48) return "ontem";
  return new Date(data).toLocaleDateString("pt-PT", { day: "numeric", month: "short" });
}

// Contagem por chave, ordenada do maior para o menor
export function contar<T>(lista: T[], chave: (x: T) => string | null | undefined) {
  const m = new Map<string, number>();
  for (const x of lista) {
    const k = chave(x);
    if (k) m.set(k, (m.get(k) ?? 0) + 1);
  }
  return [...m.entries()].sort((a, b) => b[1] - a[1]);
}

// Fichas novas nas últimas n semanas (a última é a semana corrente)
export function porSemana(imoveis: ImovelAdmin[], n = 12) {
  const fim = Date.now();
  const semanas = Array.from({ length: n }, (_, k) => ({ inicio: fim - (n - k) * 7 * DIA, total: 0 }));
  for (const i of imoveis) {
    const t = new Date(i.criado_em).getTime();
    const k = Math.floor((t - (fim - n * 7 * DIA)) / (7 * DIA));
    if (k >= 0 && k < n) semanas[k].total++;
  }
  return semanas;
}

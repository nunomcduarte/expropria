export type TipoImovel =
  | "sede" | "centro_trabalho" | "edificio" | "terreno"
  | "quinta" | "loja" | "armazem" | "outro";

export type TipoFonte =
  | "contas_partido" | "registo_predial" | "noticia" | "site_partido" | "outro";

export type Imovel = {
  id: string;
  numero: number;
  titulo: string;
  tipo: TipoImovel;
  descricao: string | null;
  entidade_proprietaria: string;
  distrito: string;
  concelho: string;
  morada: string | null;
  lat: number;
  lng: number;
  fonte_tipo: TipoFonte;
  fonte_url: string | null;
  fonte_nota: string;
  estado: "pendente" | "aprovado" | "rejeitado";
  criado_em: string;
  criado_por: string | null;
};

export type Foto = {
  id: string;
  imovel_id: string;
  caminho: string;
  legenda: string | null;
  url?: string;
};

export type Perfil = { id: string; nome_publico: string; moderador: boolean };

export const TIPOS: Record<TipoImovel, { nome: string; plural: string }> = {
  sede:            { nome: "Sede",               plural: "Sedes" },
  centro_trabalho: { nome: "Centro de trabalho", plural: "Centros" },
  edificio:        { nome: "Edifício",           plural: "Edifícios" },
  terreno:         { nome: "Terreno",            plural: "Terrenos" },
  quinta:          { nome: "Quinta",             plural: "Quintas" },
  loja:            { nome: "Loja",               plural: "Lojas" },
  armazem:         { nome: "Armazém",            plural: "Armazéns" },
  outro:           { nome: "Outro",              plural: "Outros" },
};

export const numeroFicha = (n: number) => String(n).padStart(4, "0");

export const FONTES: Record<TipoFonte, string> = {
  contas_partido: "Contas do partido (Entidade das Contas)",
  registo_predial: "Registo predial / caderneta",
  noticia: "Notícia",
  site_partido: "Site ou publicação do partido",
  outro: "Outra",
};

export const DISTRITOS = [
  "Aveiro", "Beja", "Braga", "Bragança", "Castelo Branco", "Coimbra", "Évora",
  "Faro", "Guarda", "Leiria", "Lisboa", "Portalegre", "Porto", "Santarém",
  "Setúbal", "Viana do Castelo", "Vila Real", "Viseu",
  "Região Autónoma dos Açores", "Região Autónoma da Madeira",
];

export const MOTIVOS_DENUNCIA = {
  nao_e_do_partido: "Não é do partido",
  dados_pessoais: "Mostra dados pessoais ou casa particular",
  foto_inadequada: "Foto inadequada",
  duplicado: "Duplicado",
  outro: "Outro",
} as const;

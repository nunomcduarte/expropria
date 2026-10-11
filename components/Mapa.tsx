"use client";

import "leaflet/dist/leaflet.css";
import L from "leaflet";
import { useEffect } from "react";
import { MapContainer, TileLayer, Marker, Tooltip, useMap, useMapEvents } from "react-leaflet";
import { Imovel, TIPOS } from "@/lib/tipos";

const ESTRELA = "12,1 15,9 23,9 16.5,14 19,22 12,17 5,22 7.5,14 1,9 9,9";
const estrela = (tamanho: number, classe: string) =>
  L.divIcon({
    className: `marcador ${classe}`,
    html: `<svg viewBox="0 0 24 24" width="${tamanho}" height="${tamanho}"><polygon points="${ESTRELA}" stroke-linejoin="round"/></svg>`,
    iconSize: [tamanho, tamanho],
    iconAnchor: [tamanho / 2, tamanho / 2],
    tooltipAnchor: [0, -tamanho / 2],
  });
const iconeNormal = estrela(24, "");
const iconeAtivo = estrela(40, "ativo");
const iconeNovo = estrela(40, "novo");

export const REGIOES = {
  continente: { centro: [39.6, -8.0] as [number, number], zoom: 7 },
  acores: { centro: [38.5, -28.0] as [number, number], zoom: 7 },
  madeira: { centro: [32.75, -16.95] as [number, number], zoom: 9 },
};
export type Regiao = keyof typeof REGIOES;

function Voar({ regiao }: { regiao: Regiao }) {
  const mapa = useMap();
  useEffect(() => {
    const r = REGIOES[regiao];
    mapa.flyTo(r.centro, r.zoom, { duration: 0.8 });
  }, [regiao, mapa]);
  return null;
}

function Cliques({ ativo, onClique }: { ativo: boolean; onClique: (lat: number, lng: number) => void }) {
  const mapa = useMapEvents({
    click(e) {
      if (ativo) onClique(e.latlng.lat, e.latlng.lng);
    },
  });
  useEffect(() => {
    mapa.getContainer().style.cursor = ativo ? "crosshair" : "";
    if (ativo) mapa.closePopup();
  }, [ativo, mapa]);
  return null;
}

export default function Mapa({
  imoveis,
  selecionado,
  regiao,
  aEscolher,
  novoPonto,
  onEscolher,
  onAbrir,
}: {
  imoveis: Imovel[];
  selecionado: string | null;
  regiao: Regiao;
  aEscolher: boolean;
  novoPonto: [number, number] | null;
  onEscolher: (lat: number, lng: number) => void;
  onAbrir: (i: Imovel) => void;
}) {
  return (
    <MapContainer center={REGIOES.continente.centro} zoom={REGIOES.continente.zoom} className="mapa" zoomControl={false}>
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>'
        url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"
      />
      <Voar regiao={regiao} />
      <Cliques ativo={aEscolher} onClique={onEscolher} />
      {imoveis.map((i) => (
        <Marker
          key={i.id}
          position={[i.lat, i.lng]}
          icon={i.id === selecionado ? iconeAtivo : iconeNormal}
          zIndexOffset={i.id === selecionado ? 1000 : 0}
          eventHandlers={{ click: () => onAbrir(i) }}
        >
          <Tooltip direction="top">
            {i.titulo} · {TIPOS[i.tipo].nome}
          </Tooltip>
        </Marker>
      ))}
      {novoPonto && <Marker position={novoPonto} icon={iconeNovo} />}
    </MapContainer>
  );
}

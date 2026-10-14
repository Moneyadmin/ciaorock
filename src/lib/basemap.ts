import type { Map as LeafletMap } from "leaflet";

/** Stile vettoriale gratuito di OpenFreeMap (nessuna API key), ricolorato con la palette di Ciao Rock. */
const STYLE_URL = "https://tiles.openfreemap.org/styles/positron";
const ATTRIBUTION =
  '<a href="https://openfreemap.org" target="_blank" rel="noopener">OpenFreeMap</a> © <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a>';

const PALETTE: Record<string, Record<string, string>> = {
  background: { "background-color": "#f5f3fa" },
  park: { "fill-color": "#c8f0d4" },
  landcover_wood: { "fill-color": "#bfeccc" },
  water: { "fill-color": "#a9d6ff" },
  waterway: { "line-color": "#8fcaff" },
  landuse_residential: { "fill-color": "#f0edf7" },
  building: { "fill-color": "#ebe6f5", "fill-outline-color": "#e0d9ef" },
  highway_path: { "line-color": "#ffffff" },
  highway_minor: { "line-color": "#ffffff" },
  highway_major_casing: { "line-color": "#ddd5f0" },
  highway_major_inner: { "line-color": "#ffffff" },
  highway_motorway_casing: { "line-color": "#d2c6f2" },
  highway_motorway_inner: { "line-color": "#f6f1ff" },
  road_area_pier: { "fill-color": "#f5f3fa" },
  road_pier: { "line-color": "#f5f3fa" },
  railway: { "line-color": "#d8d1ea" },
  railway_transit: { "line-color": "#d8d1ea" },
  railway_service: { "line-color": "#d8d1ea" },
  water_name_point_label: { "text-color": "#3a6fb0" },
  water_name_line_label: { "text-color": "#3a6fb0" },
  "highway-name-minor": { "text-color": "#6b6485" },
  "highway-name-major": { "text-color": "#4d4669" },
};

type StyleLayer = {
  id: string;
  type: string;
  paint?: Record<string, unknown>;
  layout?: Record<string, unknown>;
};
type StyleJson = { layers: StyleLayer[] };

/** Nomi dei luoghi in italiano quando disponibili ("Milano", non "Milan"). */
const ITALIAN_NAME = ["coalesce", ["get", "name:it"], ["get", "name"]];

let stylePromise: Promise<StyleJson> | null = null;

function loadStyle() {
  stylePromise ??= fetch(STYLE_URL)
    .then((r) => {
      if (!r.ok) throw new Error(`style ${r.status}`);
      return r.json() as Promise<StyleJson>;
    })
    .then((style) => {
      for (const layer of style.layers) {
        const paint = PALETTE[layer.id];
        if (paint) layer.paint = { ...layer.paint, ...paint };
        if (layer.id.startsWith("label_")) {
          layer.paint = { ...layer.paint, "text-color": "#2b2545", "text-halo-color": "#ffffff" };
        }
        if (layer.type === "symbol" && /shield/.test(layer.id)) {
          layer.layout = { ...layer.layout, visibility: "none" };
        } else if (
          layer.type === "symbol" &&
          JSON.stringify(layer.layout?.["text-field"] ?? "").includes("name")
        ) {
          layer.layout = { ...layer.layout, "text-field": ITALIAN_NAME };
        }
      }
      return style;
    })
    .catch((err) => {
      stylePromise = null;
      throw err;
    });
  return stylePromise;
}

function webglAvailable() {
  try {
    const canvas = document.createElement("canvas");
    return Boolean(canvas.getContext("webgl2") ?? canvas.getContext("webgl"));
  } catch {
    return false;
  }
}

/**
 * Aggiunge alla mappa Leaflet lo sfondo vettoriale moderno. Se il dispositivo non supporta
 * WebGL o lo stile non si carica, ripiega sulle classiche tile raster di OpenStreetMap.
 */
export async function addBasemap(L: typeof import("leaflet"), map: LeafletMap) {
  const fallback = () =>
    L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19,
      attribution: "© OpenStreetMap",
    }).addTo(map);

  if (!webglAvailable()) return fallback();
  try {
    const [style, , plugin] = await Promise.all([
      loadStyle(),
      import("maplibre-gl/dist/maplibre-gl.css"),
      import("@maplibre/maplibre-gl-leaflet"),
    ]);
    const layer = plugin.maplibreGL({
      style,
      attribution: ATTRIBUTION,
      interactive: false,
    } as never);
    return layer.addTo(map);
  } catch (err) {
    console.warn("[basemap] mappa vettoriale non disponibile, uso OpenStreetMap", err);
    return fallback();
  }
}

import { useEffect, useRef } from "react";
import "leaflet/dist/leaflet.css";
import type { RockRow, FriendLocation } from "@/lib/api";
import { addBasemap } from "@/lib/basemap";
import { ADMIN_HOLD_MS } from "@/lib/rules";
import { avatarGradient, initialOf, rockPinHtml } from "@/lib/pins";

type Props = {
  rocks: RockRow[];
  me: { lat: number; lng: number };
  foundIds: string[];
  onSelect: (rock: RockRow) => void;
  friends?: FriendLocation[];
  /** sassi obiettivo di una missione co-op in corso (evidenziati) */
  targetIds?: string[];
  onVisibleCount?: (count: number) => void;
  /**
   * Admin: tenere premuto un sasso per ADMIN_HOLD_MS chiama onAdminHoldDone (la pagina chiede
   * conferma); quando la pagina passa armedId, il prossimo tocco sulla mappa chiama onAdminMove.
   */
  adminMove?: boolean;
  armedId?: string | null;
  onAdminMove?: (rock: RockRow, lat: number, lng: number) => void;
  onAdminHoldStart?: (rock: RockRow) => void;
  onAdminHoldCancel?: () => void;
  onAdminHoldDone?: (rock: RockRow) => void;
};

type Cluster = { lat: number; lng: number; rocks: RockRow[] };

/**
 * Pixel-based clustering: rocks are grouped only when their pins would overlap
 * on screen, so zooming in always splits a counter into the single rocks.
 */
function clusterRocks(rocks: RockRow[], map: import("leaflet").Map, radiusPx = 46): Cluster[] {
  const points = rocks.map((rock) => ({ rock, p: map.latLngToLayerPoint([rock.lat, rock.lng]) }));
  const clusters: { rocks: RockRow[]; sx: number; sy: number }[] = [];

  for (const { rock, p } of points) {
    const hit = clusters.find(
      (c) => Math.hypot(c.sx / c.rocks.length - p.x, c.sy / c.rocks.length - p.y) < radiusPx,
    );
    if (hit) {
      hit.rocks.push(rock);
      hit.sx += p.x;
      hit.sy += p.y;
    } else {
      clusters.push({ rocks: [rock], sx: p.x, sy: p.y });
    }
  }

  return clusters.map((c) => {
    const center = map.layerPointToLatLng([c.sx / c.rocks.length, c.sy / c.rocks.length] as never);
    return { lat: center.lat, lng: center.lng, rocks: c.rocks };
  });
}

export default function MapView(props: Props) {
  const { rocks, me, foundIds } = props;
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<import("leaflet").Map | null>(null);
  const layerRef = useRef<import("leaflet").LayerGroup | null>(null);
  const leafletRef = useRef<typeof import("leaflet") | null>(null);
  const dataRef = useRef(props);
  const holdRef = useRef<{
    timers: ReturnType<typeof setTimeout>[];
    x: number;
    y: number;
    hinted: boolean;
  } | null>(null);
  const holdDoneAt = useRef(0);
  dataRef.current = props;

  // Annulla la pressione lunga in corso. Il rilascio del dito si ascolta su tutta la finestra:
  // i pin vengono ridisegnati spesso (es. a ogni aggiornamento GPS) e il "pointerup" sul pin
  // vecchio non arriverebbe mai, lasciando partire lo spostamento da solo.
  const cancelHold = useRef(() => {
    const hold = holdRef.current;
    if (!hold) return;
    hold.timers.forEach(clearTimeout);
    holdRef.current = null;
    if (hold.hinted) dataRef.current.onAdminHoldCancel?.();
  });

  const render = useRef(() => {
    const L = leafletRef.current;
    const map = mapRef.current;
    const layer = layerRef.current;
    if (!L || !map || !layer) return;
    const {
      rocks: list,
      me: mine,
      foundIds: found,
      onSelect: select,
      onVisibleCount: report,
      adminMove,
      armedId,
      onAdminHoldStart,
      onAdminHoldDone,
    } = dataRef.current;

    layer.clearLayers();

    L.marker([mine.lat, mine.lng], {
      icon: L.divIcon({ className: "", html: '<div class="me-pin"></div>', iconSize: [22, 22] }),
      interactive: false, // non deve coprire i sassi che stanno nella stessa posizione
      zIndexOffset: -1000,
    }).addTo(layer);

    const esc = (t: string) => t.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
    for (const f of dataRef.current.friends ?? []) {
      L.marker([f.lat, f.lng], {
        icon: L.divIcon({
          className: "",
          html: `<div class="friend-pin"><span class="friend-avatar" style="background:${avatarGradient(f.nickname)}">${esc(initialOf(f.nickname))}</span><span class="friend-name">${esc(f.nickname)}</span></div>`,
          iconSize: [80, 62],
          iconAnchor: [40, 20],
        }),
        zIndexOffset: 500,
      })
        .addTo(layer)
        .bindPopup(`<strong>@${esc(f.nickname)}</strong><br/>In esplorazione!`);
    }

    const bounds = map.getBounds();
    const visible = list.filter((rock) => bounds.contains([rock.lat, rock.lng]));
    report?.(visible.length);

    const zoom = map.getZoom();
    for (const cluster of clusterRocks(list, map, zoom >= 17 ? 0 : 46)) {
      if (cluster.rocks.length === 1) {
        const rock = cluster.rocks[0]!;
        const isFound = found.includes(rock.id);
        const armed = armedId === rock.id;
        const marker = L.marker([rock.lat, rock.lng], {
          icon: L.divIcon({
            className: "",
            html: rockPinHtml({
              found: isFound,
              dragging: armed,
              target: (dataRef.current.targetIds ?? []).includes(rock.id),
            }),
            iconSize: [44, 52],
            iconAnchor: [22, 50],
          }),
        }).addTo(layer);

        marker.on("click", () => {
          if (dataRef.current.armedId) return; // in attesa del punto di destinazione
          if (Date.now() - holdDoneAt.current < 1000) return; // è il rilascio della pressione lunga
          select(rock);
        });

        if (adminMove && !armedId) {
          const el = marker.getElement();
          el?.addEventListener("pointerdown", (event) => {
            if (!event.isPrimary) return;
            cancelHold.current();
            const hold = {
              x: event.clientX,
              y: event.clientY,
              hinted: false,
              timers: [] as ReturnType<typeof setTimeout>[],
            };
            // l'avviso compare solo se la pressione dura: un tocco normale apre la scheda e basta
            hold.timers.push(
              setTimeout(() => {
                hold.hinted = true;
                onAdminHoldStart?.(rock);
              }, 800),
              setTimeout(() => {
                holdRef.current = null;
                holdDoneAt.current = Date.now();
                onAdminHoldDone?.(rock);
              }, ADMIN_HOLD_MS),
            );
            holdRef.current = hold;
          });
        }
      } else {
        L.marker([cluster.lat, cluster.lng], {
          icon: L.divIcon({
            className: "",
            html: `<div class="cluster-pin">${cluster.rocks.length}</div>`,
            iconSize: [46, 46],
            iconAnchor: [23, 23],
          }),
        })
          .addTo(layer)
          .on("click", () => {
            const group = L.latLngBounds(
              cluster.rocks.map((r) => [r.lat, r.lng] as [number, number]),
            );
            if (group.getNorthEast().equals(group.getSouthWest())) {
              map.setView(group.getCenter(), Math.max(17, Math.min(zoom + 3, 19)));
            } else {
              map.fitBounds(group.pad(0.3), { maxZoom: 19 });
            }
          });
      }
    }
  });

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const L = (await import("leaflet")).default;
      if (cancelled || !containerRef.current || mapRef.current) return;
      leafletRef.current = L;

      const map = L.map(containerRef.current, {
        center: [dataRef.current.me.lat, dataRef.current.me.lng],
        zoom: 15,
        maxZoom: 19,
        zoomControl: false,
      });
      void addBasemap(L, map);

      mapRef.current = map;
      layerRef.current = L.layerGroup().addTo(map);
      map.on("zoomend moveend", () => render.current());
      map.on("movestart zoomstart", () => cancelHold.current());
      map.on("click", (event: import("leaflet").LeafletMouseEvent) => {
        const id = dataRef.current.armedId;
        if (!id) return;
        const rock = dataRef.current.rocks.find((r) => r.id === id);
        if (rock) dataRef.current.onAdminMove?.(rock, event.latlng.lat, event.latlng.lng);
      });
      render.current();
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    render.current();
  }, [rocks, foundIds, me.lat, me.lng, props.friends, props.targetIds, props.armedId]);

  // Il dito lascia lo schermo (ovunque) o si sposta di più di qualche pixel: niente spostamento.
  useEffect(() => {
    const cancel = cancelHold.current;
    const up = () => cancel();
    const move = (event: PointerEvent) => {
      const hold = holdRef.current;
      if (hold && Math.hypot(event.clientX - hold.x, event.clientY - hold.y) > 12) {
        cancel();
      }
    };
    window.addEventListener("pointerup", up);
    window.addEventListener("pointercancel", up);
    window.addEventListener("pointermove", move);
    return () => {
      window.removeEventListener("pointerup", up);
      window.removeEventListener("pointercancel", up);
      window.removeEventListener("pointermove", move);
      cancel();
    };
  }, []);

  useEffect(() => {
    return () => {
      mapRef.current?.remove();
      mapRef.current = null;
    };
  }, []);

  return <div ref={containerRef} className="map-fullscreen h-full w-full" />;
}

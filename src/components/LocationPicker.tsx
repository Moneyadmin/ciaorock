import { useEffect, useRef } from "react";
import "leaflet/dist/leaflet.css";

type Props = {
  value: { lat: number; lng: number };
  onChange: (position: { lat: number; lng: number }) => void;
};

/** Small map with a draggable pin, for adjusting the exact hiding spot by hand. */
export default function LocationPicker({ value, onChange }: Props) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<import("leaflet").Map | null>(null);
  const markerRef = useRef<import("leaflet").Marker | null>(null);
  const changeRef = useRef(onChange);
  changeRef.current = onChange;

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const L = (await import("leaflet")).default;
      if (cancelled || !containerRef.current || mapRef.current) return;

      const map = L.map(containerRef.current, {
        center: [value.lat, value.lng],
        zoom: 18,
        zoomControl: true,
        attributionControl: false,
      });
      L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", { maxZoom: 19 }).addTo(map);

      const marker = L.marker([value.lat, value.lng], {
        draggable: true,
        icon: L.divIcon({
          className: "",
          html: '<div class="rock-pin">🪨</div>',
          iconSize: [40, 40],
          iconAnchor: [20, 20],
        }),
      }).addTo(map);

      marker.on("dragend", () => {
        const pos = marker.getLatLng();
        changeRef.current({ lat: pos.lat, lng: pos.lng });
      });
      map.on("click", (event: import("leaflet").LeafletMouseEvent) => {
        marker.setLatLng(event.latlng);
        changeRef.current({ lat: event.latlng.lat, lng: event.latlng.lng });
      });

      mapRef.current = map;
      markerRef.current = marker;
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const marker = markerRef.current;
    const map = mapRef.current;
    if (!marker || !map) return;
    const current = marker.getLatLng();
    if (Math.abs(current.lat - value.lat) < 1e-7 && Math.abs(current.lng - value.lng) < 1e-7) return;
    marker.setLatLng([value.lat, value.lng]);
    map.setView([value.lat, value.lng], map.getZoom());
  }, [value.lat, value.lng]);

  useEffect(() => {
    return () => {
      mapRef.current?.remove();
      mapRef.current = null;
    };
  }, []);

  return <div ref={containerRef} className="h-56 w-full overflow-hidden rounded-2xl" />;
}

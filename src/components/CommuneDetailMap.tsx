"use client";

import { useEffect, useRef } from "react";
import { MapLibreMap, Marker, NavigationControl } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import bbox from "@turf/bbox";
import type { CommuneFeature, Listing } from "@/lib/types";
import { formatPriceShort } from "@/lib/format";
import { MAP_STYLE_URL } from "@/lib/map";

type Props = {
  commune: CommuneFeature;
  listings: Listing[];
  selectedId: string | null;
  onSelectListing: (id: string) => void;
};

export default function CommuneDetailMap({
  commune,
  listings,
  selectedId,
  onSelectListing,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const markersRef = useRef<Record<string, Marker>>({});
  const onSelectRef = useRef(onSelectListing);

  useEffect(() => {
    onSelectRef.current = onSelectListing;
  }, [onSelectListing]);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const map = new MapLibreMap({
      container: containerRef.current,
      style: MAP_STYLE_URL,
      attributionControl: { compact: true },
    });
    mapRef.current = map;
    map.addControl(new NavigationControl({}), "top-right");

    map.on("load", () => {
      map.addSource("commune-boundary", {
        type: "geojson",
        data: commune as GeoJSON.Feature,
      });
      map.addLayer({
        id: "commune-boundary-fill",
        type: "fill",
        source: "commune-boundary",
        paint: { "fill-color": "#3b82f6", "fill-opacity": 0.08 },
      });
      map.addLayer({
        id: "commune-boundary-outline",
        type: "line",
        source: "commune-boundary",
        paint: { "line-color": "#1e3a8a", "line-width": 2 },
      });

      const bounds = bbox(commune) as [number, number, number, number];
      map.fitBounds(bounds, { padding: 40, duration: 0 });

      for (const listing of listings) {
        const el = document.createElement("button");
        el.type = "button";
        el.className = "listing-marker";
        el.textContent = formatPriceShort(listing.price);
        el.setAttribute("aria-label", `${listing.title}, ${formatPriceShort(listing.price)}`);
        el.addEventListener("click", (e) => {
          e.stopPropagation();
          onSelectRef.current(listing.id);
        });

        const marker = new Marker({ element: el, anchor: "bottom" })
          .setLngLat([listing.lng, listing.lat])
          .addTo(map);

        markersRef.current[listing.id] = marker;
      }
    });

    return () => {
      map.remove();
      mapRef.current = null;
      markersRef.current = {};
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    for (const [id, marker] of Object.entries(markersRef.current)) {
      const el = marker.getElement();
      el.classList.toggle("listing-marker--active", id === selectedId);
    }
    if (selectedId && mapRef.current) {
      const marker = markersRef.current[selectedId];
      if (marker) {
        mapRef.current.flyTo({ center: marker.getLngLat(), duration: 500 });
      }
    }
  }, [selectedId]);

  return (
    <div
      ref={containerRef}
      className="h-full w-full"
      role="application"
      aria-label={`Map of listings in ${commune.properties.name}`}
    />
  );
}

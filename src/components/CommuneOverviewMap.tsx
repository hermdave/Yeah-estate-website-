"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { MapLibreMap, NavigationControl } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import bbox from "@turf/bbox";
import type { CommuneFeatureCollection } from "@/lib/types";
import { LUXEMBOURG_BOUNDS, MAP_STYLE_URL } from "@/lib/map";

type Props = {
  communes: CommuneFeatureCollection;
  listingCounts: Record<string, number>;
};

export default function CommuneOverviewMap({
  communes,
  listingCounts,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const router = useRouter();

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const withCounts: CommuneFeatureCollection = {
      ...communes,
      features: communes.features.map((f) => ({
        ...f,
        properties: {
          ...f.properties,
          listingCount: listingCounts[f.properties.slug] ?? 0,
        },
      })),
    };

    const map = new MapLibreMap({
      container: containerRef.current,
      style: MAP_STYLE_URL,
      bounds: LUXEMBOURG_BOUNDS,
      fitBoundsOptions: { padding: 24 },
      attributionControl: { compact: true },
    });
    mapRef.current = map;
    map.addControl(new NavigationControl({}), "top-right");

    map.on("load", () => {
      map.addSource("communes", {
        type: "geojson",
        data: withCounts as GeoJSON.FeatureCollection,
        generateId: true,
      });

      map.addLayer({
        id: "communes-fill",
        type: "fill",
        source: "communes",
        paint: {
          "fill-color": [
            "case",
            ["boolean", ["feature-state", "hover"], false],
            "#2563eb",
            "#3b82f6",
          ],
          "fill-opacity": [
            "case",
            ["boolean", ["feature-state", "hover"], false],
            0.55,
            0.25,
          ],
        },
      });

      map.addLayer({
        id: "communes-outline",
        type: "line",
        source: "communes",
        paint: {
          "line-color": "#1e3a8a",
          "line-width": 1,
        },
      });

      map.addLayer({
        id: "communes-labels",
        type: "symbol",
        source: "communes",
        minzoom: 9.5,
        layout: {
          "text-field": ["get", "name"],
          "text-size": 11,
          "text-font": ["Noto Sans Regular"],
        },
        paint: {
          "text-color": "#1e293b",
          "text-halo-color": "#ffffff",
          "text-halo-width": 1.2,
        },
      });

      try {
        const bounds = bbox(withCounts) as [number, number, number, number];
        map.fitBounds(bounds, { padding: 24, duration: 0 });
      } catch {
        // ignore
      }

      let hoveredId: string | number | null = null;

      map.on("mousemove", "communes-fill", (e) => {
        map.getCanvas().style.cursor = "pointer";
        if (!e.features?.length) return;
        const feature = e.features[0];
        if (hoveredId !== null) {
          map.setFeatureState(
            { source: "communes", id: hoveredId },
            { hover: false }
          );
        }
        hoveredId = feature.id ?? null;
        if (hoveredId !== null) {
          map.setFeatureState(
            { source: "communes", id: hoveredId },
            { hover: true }
          );
        }
      });

      map.on("mouseleave", "communes-fill", () => {
        map.getCanvas().style.cursor = "";
        if (hoveredId !== null) {
          map.setFeatureState(
            { source: "communes", id: hoveredId },
            { hover: false }
          );
        }
        hoveredId = null;
      });

      map.on("click", "communes-fill", (e) => {
        const slug = e.features?.[0]?.properties?.slug;
        if (slug) router.push(`/commune/${slug}`);
      });
    });

    return () => {
      map.remove();
      mapRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div
      ref={containerRef}
      className="h-full w-full"
      role="application"
      aria-label="Map of Luxembourg communes"
    />
  );
}

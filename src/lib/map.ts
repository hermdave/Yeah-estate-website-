// Free, no-API-key vector tiles for MapLibre GL, courtesy of OpenFreeMap
// (https://openfreemap.org). Fine for a demo/small project; swap in your own
// MapTiler/Mapbox style + key for production traffic volumes.
export const MAP_STYLE_URL =
  process.env.NEXT_PUBLIC_MAP_STYLE_URL ??
  "https://tiles.openfreemap.org/styles/liberty";

// Luxembourg's approximate bounding box [west, south, east, north].
export const LUXEMBOURG_BOUNDS: [number, number, number, number] = [
  5.68, 49.43, 6.55, 50.19,
];

export const LUXEMBOURG_CENTER: [number, number] = [6.1296, 49.8153];

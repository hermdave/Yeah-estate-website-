// Prepares static data used by the app:
//  1. Reads the raw commune boundaries (scripts/communes-raw.geojson, sourced from
//     Code for Germany's "click_that_hood" open dataset, OSM-derived), adds a slug
//     per commune, and writes public/data/communes.geojson.
//  2. Generates realistic-looking MOCK listings scattered inside each commune's
//     real polygon (via turf) and writes public/data/listings.json.
//
// Re-run with: node scripts/generate-data.mjs
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import * as turf from "@turf/turf";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");

function slugify(name) {
  return name
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

// Rough price-per-sqm tiers (EUR), loosely reflecting real Luxembourg market
// patterns (capital + "red zone" south-west commuter belt cost more than
// rural north/east). This is illustrative mock data, not a valuation model.
const PREMIUM_COMMUNES = new Set(
  [
    "Luxembourg",
    "Strassen",
    "Bertrange",
    "Walferdange",
    "Niederanven",
    "Hesperange",
    "Contern",
    "Sandweiler",
    "Mamer",
    "Kopstal",
  ].map(slugify)
);

const MID_COMMUNES = new Set(
  [
    "Esch-sur-Alzette",
    "Dudelange",
    "Differdange",
    "Sanem",
    "Bettembourg",
    "Roeser",
    "Mondercange",
    "Schifflange",
    "Kayl",
    "Rumelange",
    "Ettelbruck",
    "Diekirch",
    "Junglinster",
    "Mersch",
    "Capellen",
    "Steinsel",
    "Lorentzweiler",
    "Grevenmacher",
    "Remich",
  ].map(slugify)
);

function priceTier(slug) {
  if (PREMIUM_COMMUNES.has(slug)) return { min: 8500, max: 13500 };
  if (MID_COMMUNES.has(slug)) return { min: 6500, max: 9500 };
  return { min: 4500, max: 7500 };
}

const TYPES = [
  { type: "Apartment", weight: 5, bedroomRange: [1, 3], areaRange: [40, 110] },
  { type: "Studio", weight: 2, bedroomRange: [0, 1], areaRange: [22, 45] },
  { type: "House", weight: 3, bedroomRange: [3, 6], areaRange: [110, 260] },
  { type: "Duplex", weight: 2, bedroomRange: [2, 4], areaRange: [80, 160] },
  { type: "Villa", weight: 1, bedroomRange: [4, 7], areaRange: [220, 420] },
];
const TYPE_POOL = TYPES.flatMap((t) => Array(t.weight).fill(t));

const STREET_NAMES = [
  "Rue de la Gare", "Rue de Luxembourg", "Rue Principale", "Rue de l'Église",
  "Rue des Champs", "Rue du Cimetière", "Rue de la Libération", "Rue Haute",
  "Rue Basse", "Am Duerf", "Rue de la Forêt", "Rue du Moulin", "Rue des Roses",
  "Rue de l'École", "Rue du Château", "Route de Longwy", "Route d'Arlon",
  "Route de Thionville", "Avenue de la Gare", "Rue des Prés",
];

const ENERGY_CLASSES = ["A", "A", "B", "B", "C", "C", "D", "E"];

function mulberry32(seed) {
  return function () {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function pick(rng, arr) {
  return arr[Math.floor(rng() * arr.length)];
}
function randInt(rng, min, max) {
  return Math.round(min + rng() * (max - min));
}
function randomPointInPolygon(rng, feature) {
  const bbox = turf.bbox(feature);
  for (let i = 0; i < 300; i++) {
    const lng = bbox[0] + rng() * (bbox[2] - bbox[0]);
    const lat = bbox[1] + rng() * (bbox[3] - bbox[1]);
    const pt = turf.point([lng, lat]);
    if (turf.booleanPointInPolygon(pt, feature)) {
      return [lng, lat];
    }
  }
  // Fallback: centroid (should basically never happen for these polygons)
  return turf.centroid(feature).geometry.coordinates;
}

function main() {
  const raw = JSON.parse(
    readFileSync(path.join(root, "scripts/communes-raw.geojson"), "utf-8")
  );

  const seenSlugs = new Map();
  raw.features.forEach((f) => {
    const name = f.properties.name;
    let slug = slugify(name);
    if (seenSlugs.has(slug)) {
      const n = seenSlugs.get(slug) + 1;
      seenSlugs.set(slug, n);
      slug = `${slug}-${n}`;
    } else {
      seenSlugs.set(slug, 1);
    }
    f.properties = { name, slug };
  });

  writeFileSync(
    path.join(root, "public/data/communes.geojson"),
    JSON.stringify(raw)
  );

  const listings = [];
  let idCounter = 1;
  const rng = mulberry32(1337);

  for (const feature of raw.features) {
    const { name, slug } = feature.properties;
    const area = turf.area(feature); // m^2
    // Bigger communes get more mock listings; clamp to a sane range.
    const count = Math.max(2, Math.min(9, Math.round(area / 3_500_000)));
    const tier = priceTier(slug);

    for (let i = 0; i < count; i++) {
      const [lng, lat] = randomPointInPolygon(rng, feature);
      const t = pick(rng, TYPE_POOL);
      const livingArea = randInt(rng, t.areaRange[0], t.areaRange[1]);
      const bedrooms = randInt(rng, t.bedroomRange[0], t.bedroomRange[1]);
      const bathrooms = Math.max(1, Math.round(bedrooms * 0.6) || 1);
      const pricePerSqm = randInt(rng, tier.min, tier.max);
      const isHouseLike = t.type === "House" || t.type === "Villa";
      const landArea = isHouseLike
        ? randInt(rng, livingArea + 50, livingArea + 600)
        : null;
      const price = Math.round((livingArea * pricePerSqm) / 1000) * 1000;
      const yearBuilt = randInt(rng, 1950, 2024);
      const listedDaysAgo = randInt(rng, 0, 90);
      const listedDate = new Date(
        Date.now() - listedDaysAgo * 24 * 60 * 60 * 1000
      )
        .toISOString()
        .slice(0, 10);

      listings.push({
        id: `lst-${idCounter++}`,
        communeSlug: slug,
        communeName: name,
        title: `${t.type} in ${name}`,
        type: t.type,
        price,
        pricePerSqm,
        livingArea,
        landArea,
        bedrooms,
        bathrooms,
        yearBuilt,
        energyClass: pick(rng, ENERGY_CLASSES),
        address: `${randInt(rng, 1, 140)} ${pick(rng, STREET_NAMES)}, ${name}`,
        listedDate,
        lat,
        lng,
        description: `${t.type} located in ${name}, Luxembourg. ${livingArea} m² of living space${
          landArea ? ` on a ${landArea} m² plot` : ""
        }, ${bedrooms} bedroom${bedrooms === 1 ? "" : "s"} and ${bathrooms} bathroom${
          bathrooms === 1 ? "" : "s"
        }. Energy class ${pick(rng, ENERGY_CLASSES)}. (Sample listing — not a real property.)`,
      });
    }
  }

  writeFileSync(
    path.join(root, "public/data/listings.json"),
    JSON.stringify(listings)
  );

  console.log(
    `Wrote ${raw.features.length} communes and ${listings.length} mock listings.`
  );
}

main();

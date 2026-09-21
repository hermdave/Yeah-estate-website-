import { readFile } from "node:fs/promises";
import path from "node:path";
import type { CommuneFeatureCollection, Listing } from "./types";

const dataDir = path.join(process.cwd(), "public", "data");

let communesCache: CommuneFeatureCollection | null = null;
let listingsCache: Listing[] | null = null;

export async function getCommunes(): Promise<CommuneFeatureCollection> {
  if (!communesCache) {
    const raw = await readFile(
      path.join(dataDir, "communes.geojson"),
      "utf-8"
    );
    communesCache = JSON.parse(raw) as CommuneFeatureCollection;
  }
  return communesCache;
}

export async function getListings(): Promise<Listing[]> {
  if (!listingsCache) {
    const raw = await readFile(path.join(dataDir, "listings.json"), "utf-8");
    listingsCache = JSON.parse(raw) as Listing[];
  }
  return listingsCache;
}

export async function getCommuneBySlug(slug: string) {
  const communes = await getCommunes();
  return communes.features.find((f) => f.properties.slug === slug) ?? null;
}

export async function getListingsForCommune(
  slug: string
): Promise<Listing[]> {
  const listings = await getListings();
  return listings.filter((l) => l.communeSlug === slug);
}

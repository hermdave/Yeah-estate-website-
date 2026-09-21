export type Listing = {
  id: string;
  communeSlug: string;
  communeName: string;
  title: string;
  type: string;
  price: number;
  pricePerSqm: number;
  livingArea: number;
  landArea: number | null;
  bedrooms: number;
  bathrooms: number;
  yearBuilt: number;
  energyClass: string;
  address: string;
  listedDate: string;
  lat: number;
  lng: number;
  description: string;
};

export type CommuneProperties = {
  name: string;
  slug: string;
};

export type CommuneFeature = GeoJSON.Feature<
  GeoJSON.Polygon | GeoJSON.MultiPolygon,
  CommuneProperties
>;

export type CommuneFeatureCollection = GeoJSON.FeatureCollection<
  GeoJSON.Polygon | GeoJSON.MultiPolygon,
  CommuneProperties
>;

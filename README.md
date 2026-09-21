# LuxHomes — Luxembourg real estate map

An interactive map of Luxembourg's communes. Click a commune to zoom in and
see property listings plotted on the map; click a listing to see its details
(price, size, bedrooms, etc.).

**This currently ships with generated mock listings, not real scraped data**
— see [Data](#data) below for why, and what to do next.

## Stack

- [Next.js](https://nextjs.org) (App Router, static export) + TypeScript + Tailwind CSS
- [MapLibre GL JS](https://maplibre.org/) for the interactive maps, using free
  [OpenFreeMap](https://openfreemap.org) vector tiles (no API key required)
- Commune boundaries sourced from Code for Germany's
  [`click_that_hood`](https://github.com/codeforgermany/click_that_hood) dataset
  (OpenStreetMap-derived, ODbL), simplified with [mapshaper](https://mapshaper.org)

No backend/database — it's a fully static site.

## Getting started

```bash
npm install
npm run dev
```

Open http://localhost:3000.

To produce the deployable static site:

```bash
npm run build
```

This outputs a static `out/` folder (`output: 'export'` in `next.config.ts`)
that can be hosted on GitHub Pages, Netlify, Vercel, S3, or any static file
host.

## Project structure

- `src/app/page.tsx` — country-level map (all communes)
- `src/app/commune/[slug]/` — per-commune map + listing list/detail panel
- `src/components/CommuneOverviewMap.tsx` — MapLibre map of commune polygons
- `src/components/CommuneDetailMap.tsx` — MapLibre map of listings within one commune
- `src/components/ListingPanel.tsx` — listing detail panel
- `src/lib/data.ts` — reads the static JSON/GeoJSON data files (server-side)
- `public/data/communes.geojson` — commune boundaries + `slug`/`name`
- `public/data/listings.json` — mock listings
- `scripts/generate-data.mjs` — regenerates both files above (see below)

### Regenerating data

```bash
node scripts/generate-data.mjs
```

This slugifies commune names and scatters a plausible number of mock
listings inside each commune's real polygon (using `@turf/turf` for
point-in-polygon sampling), with per-commune price tiers loosely modeled on
real Luxembourg market geography (capital + inner "red zone" commuter belt
priced higher than rural areas). All listing data is synthetic —
prices/addresses/descriptions are generated, not scraped.

### Swapping the map style

`src/lib/map.ts` exports `MAP_STYLE_URL`, overridable via the
`NEXT_PUBLIC_MAP_STYLE_URL` env var — useful if you want to switch to a
MapTiler/Mapbox style (with your own API key) for production traffic
instead of the free OpenFreeMap tiles.

## Data

### Commune boundaries

Real boundaries, from OpenStreetMap (via `click_that_hood`), dated ~2015 —
Luxembourg has merged a handful of communes since then (e.g.
Boevange-sur-Attert → Helperknapp), so a few names/borders are stale. Good
enough for an MVP; refresh from Luxembourg's official
[geoportal open data](https://data.public.lu) (ACT/LIMADM dataset) when
accuracy matters.

### Listings — why mock data, and what's next

Real Luxembourg listings live on sites like athome.lu, immotop.lu, and
similar portals. Scraping them was intentionally **not** done here because
it very likely violates those sites' Terms of Service, and possibly
database/IP rights on the compiled listing data (in the EU this can
implicate the *sui generis* database right, separate from copyright).
Scraping without permission also risks the source blocking your IP or
pursuing legal action, and provides no way to keep data fresh without
repeating the (still legally risky) scrape.

Legitimate options to get real listings, roughly in order of effort:

1. **Official/licensed data feed or API.** Some portals offer partner/API
   access (sometimes paid) meant exactly for this kind of use — check
   athome.lu, immotop.lu, or aggregators for a "data partner" / API program.
2. **Government/open data.** Luxembourg's
   [data.public.lu](https://data.public.lu) occasionally has property
   transaction data (e.g. from the Land Registry, "Observatoire de
   l'Habitat"), which is legally reusable but is transaction/price data, not
   live listings.
3. **Manual or user-submitted listings.** Let agents/owners submit their own
   listings — sidesteps scraping entirely, though it starts empty.
4. **Scraping, only if you check first.** If you go this route, read the
   target site's `robots.txt` and Terms of Service yourself, consider
   contacting the site for permission, rate-limit heavily, and cache
   aggressively so you're not hammering their servers. This repo doesn't
   include a scraper, and I'd suggest getting that legal footing sorted
   before building one.

## Known limitations / next steps

- Listings are synthetic (see above).
- Commune boundaries are ~2015-era (see above).
- No search/filtering (by price, bedrooms, type) on the listings yet.
- No listing photos (mock data has none) — would need a real image source
  once real listings are wired up.
- No automated tests.

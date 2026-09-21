import Header from "@/components/Header";
import CommuneOverviewMap from "@/components/CommuneOverviewMap";
import { getCommunes, getListings } from "@/lib/data";

export default async function Home() {
  const [communes, listings] = await Promise.all([
    getCommunes(),
    getListings(),
  ]);

  const listingCounts: Record<string, number> = {};
  for (const listing of listings) {
    listingCounts[listing.communeSlug] =
      (listingCounts[listing.communeSlug] ?? 0) + 1;
  }

  return (
    <div className="flex h-screen flex-col">
      <Header />
      <div className="flex items-center gap-2 border-b border-slate-200 bg-white px-4 py-2 text-sm text-slate-600">
        <span>
          Explore Luxembourg by commune — click a commune to see its
          listings.
        </span>
        <span className="ml-auto rounded-full bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-700">
          {listings.length} sample listings
        </span>
      </div>
      <main className="min-h-0 flex-1">
        <CommuneOverviewMap communes={communes} listingCounts={listingCounts} />
      </main>
    </div>
  );
}

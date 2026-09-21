"use client";

import { useMemo, useState } from "react";
import dynamic from "next/dynamic";
import type { CommuneFeature, Listing } from "@/lib/types";
import ListingPanel from "@/components/ListingPanel";
import { formatPriceShort } from "@/lib/format";

const CommuneDetailMap = dynamic(
  () => import("@/components/CommuneDetailMap"),
  { ssr: false }
);

type Props = {
  commune: CommuneFeature;
  listings: Listing[];
};

export default function CommuneDetailClient({ commune, listings }: Props) {
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const selectedListing = useMemo(
    () => listings.find((l) => l.id === selectedId) ?? null,
    [listings, selectedId]
  );

  return (
    <div className="flex h-full">
      <div className="relative min-w-0 flex-1">
        <CommuneDetailMap
          commune={commune}
          listings={listings}
          selectedId={selectedId}
          onSelectListing={setSelectedId}
        />
        {listings.length === 0 && (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
            <div className="rounded-lg bg-white/90 px-4 py-2 text-sm text-slate-600 shadow">
              No listings in {commune.properties.name} yet.
            </div>
          </div>
        )}
      </div>

      <aside className="flex w-[360px] shrink-0 flex-col border-l border-slate-200 bg-white">
        <div className="border-b border-slate-200 p-3">
          <h1 className="text-base font-semibold text-slate-900">
            {commune.properties.name}
          </h1>
          <p className="text-xs text-slate-500">
            {listings.length} listing{listings.length === 1 ? "" : "s"}
          </p>
        </div>

        {selectedListing ? (
          <ListingPanel
            listing={selectedListing}
            onClose={() => setSelectedId(null)}
          />
        ) : (
          <ul className="min-h-0 flex-1 overflow-y-auto divide-y divide-slate-100">
            {listings.map((listing) => (
              <li key={listing.id}>
                <button
                  type="button"
                  onClick={() => setSelectedId(listing.id)}
                  className="flex w-full flex-col gap-0.5 px-3 py-2.5 text-left hover:bg-slate-50"
                >
                  <span className="flex items-center justify-between">
                    <span className="text-sm font-medium text-slate-900">
                      {listing.title}
                    </span>
                    <span className="text-sm font-semibold text-blue-900">
                      {formatPriceShort(listing.price)}
                    </span>
                  </span>
                  <span className="text-xs text-slate-500">
                    {listing.livingArea} m² · {listing.bedrooms} bed ·{" "}
                    {listing.address}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </aside>
    </div>
  );
}

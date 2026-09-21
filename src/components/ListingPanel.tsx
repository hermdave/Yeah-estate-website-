"use client";

import type { Listing } from "@/lib/types";
import { formatListedDate, formatPrice } from "@/lib/format";

type Props = {
  listing: Listing | null;
  onClose: () => void;
};

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-0.5 rounded-lg bg-slate-50 px-3 py-2">
      <span className="text-xs text-slate-500">{label}</span>
      <span className="text-sm font-semibold text-slate-900">{value}</span>
    </div>
  );
}

export default function ListingPanel({ listing, onClose }: Props) {
  if (!listing) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-2 p-8 text-center text-slate-400">
        <p className="text-sm">
          Select a listing on the map to see its details here.
        </p>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col overflow-y-auto">
      <div className="flex items-start justify-between gap-3 border-b border-slate-200 p-4">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">
            {listing.title}
          </h2>
          <p className="text-sm text-slate-500">{listing.address}</p>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close listing details"
          className="shrink-0 rounded-full p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
        >
          ✕
        </button>
      </div>

      <div className="flex flex-col gap-4 p-4">
        <div>
          <div className="text-2xl font-bold text-blue-900">
            {formatPrice(listing.price)}
          </div>
          <div className="text-xs text-slate-500">
            €{listing.pricePerSqm.toLocaleString("en-LU")} / m² ·{" "}
            {formatListedDate(listing.listedDate)}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <Stat label="Type" value={listing.type} />
          <Stat label="Living area" value={`${listing.livingArea} m²`} />
          <Stat
            label="Bedrooms"
            value={String(listing.bedrooms)}
          />
          <Stat label="Bathrooms" value={String(listing.bathrooms)} />
          {listing.landArea && (
            <Stat label="Plot size" value={`${listing.landArea} m²`} />
          )}
          <Stat label="Year built" value={String(listing.yearBuilt)} />
          <Stat label="Energy class" value={listing.energyClass} />
        </div>

        <div>
          <h3 className="mb-1 text-sm font-semibold text-slate-900">
            Description
          </h3>
          <p className="text-sm leading-relaxed text-slate-600">
            {listing.description}
          </p>
        </div>

        <p className="rounded-lg bg-amber-50 p-3 text-xs text-amber-800">
          This is sample data generated for demo purposes — it is not a real
          property listing.
        </p>
      </div>
    </div>
  );
}

import { notFound } from "next/navigation";
import Header from "@/components/Header";
import CommuneDetailClient from "./CommuneDetailClient";
import { getCommuneBySlug, getCommunes, getListingsForCommune } from "@/lib/data";

export async function generateStaticParams() {
  const communes = await getCommunes();
  return communes.features.map((f) => ({ slug: f.properties.slug }));
}

export const dynamicParams = false;

type Params = { slug: string };

export default async function CommunePage({
  params,
}: {
  params: Promise<Params>;
}) {
  const { slug } = await params;
  const [commune, listings] = await Promise.all([
    getCommuneBySlug(slug),
    getListingsForCommune(slug),
  ]);

  if (!commune) notFound();

  return (
    <div className="flex h-screen flex-col">
      <Header
        breadcrumb={[
          { label: "Luxembourg", href: "/" },
          { label: commune.properties.name },
        ]}
      />
      <main className="min-h-0 flex-1">
        <CommuneDetailClient commune={commune} listings={listings} />
      </main>
    </div>
  );
}

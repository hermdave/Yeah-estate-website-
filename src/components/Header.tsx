import Link from "next/link";

export default function Header({
  breadcrumb,
}: {
  breadcrumb?: { label: string; href?: string }[];
}) {
  return (
    <header className="flex h-14 shrink-0 items-center gap-4 border-b border-slate-200 bg-white px-4">
      <Link href="/" className="flex items-center gap-2 font-semibold text-slate-900">
        <span aria-hidden className="text-lg">🏠</span>
        LuxHomes
      </Link>
      {breadcrumb && breadcrumb.length > 0 && (
        <nav aria-label="Breadcrumb" className="flex items-center gap-1 text-sm text-slate-500">
          <span aria-hidden>/</span>
          {breadcrumb.map((crumb, i) => (
            <span key={i} className="flex items-center gap-1">
              {crumb.href ? (
                <Link href={crumb.href} className="hover:text-blue-700">
                  {crumb.label}
                </Link>
              ) : (
                <span className="text-slate-900">{crumb.label}</span>
              )}
              {i < breadcrumb.length - 1 && <span aria-hidden>/</span>}
            </span>
          ))}
        </nav>
      )}
    </header>
  );
}

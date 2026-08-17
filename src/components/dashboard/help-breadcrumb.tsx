import Link from "next/link";
import { ChevronLeftIcon, HomeIcon } from "@/components/shared/icons";

export function HelpBreadcrumb({ items }: { items: { label: string; href?: string }[] }) {
  return (
    <nav className="mb-4 flex flex-wrap items-center gap-1.5 text-[12.5px] text-muted">
      <Link href="/dashboard/help" className="flex items-center gap-1 font-bold hover:text-accent-600">
        <HomeIcon className="h-3.5 w-3.5" /> مركز المساعدة
      </Link>
      {items.map((item, i) => (
        <span key={i} className="flex items-center gap-1.5">
          <ChevronLeftIcon className="h-3 w-3 text-faint" />
          {item.href ? (
            <Link href={item.href} className="font-bold hover:text-accent-600">
              {item.label}
            </Link>
          ) : (
            <span className="font-bold text-foreground">{item.label}</span>
          )}
        </span>
      ))}
    </nav>
  );
}

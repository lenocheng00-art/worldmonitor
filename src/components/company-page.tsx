import type { LucideIcon } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { SignalCard } from "@/components/signal-card";
import type { SignalItem } from "@/lib/data";

export function CompanyPage({
  eyebrow,
  title,
  description,
  icon: Icon,
  items,
}: {
  eyebrow: string;
  title: string;
  description: string;
  icon: LucideIcon;
  items: SignalItem[];
}) {
  return (
    <div className="space-y-6">
      <div className="flex items-start gap-4">
        <div className="mt-1 flex size-11 shrink-0 items-center justify-center rounded-md bg-primary text-primary-foreground">
          <Icon className="size-5" />
        </div>
        <PageHeader eyebrow={eyebrow} title={title} description={description} />
      </div>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {items.map((item) => (
          <SignalCard key={item.name} item={item} />
        ))}
      </div>
    </div>
  );
}

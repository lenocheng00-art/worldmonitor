import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SignalCard } from "@/components/signal-card";
import type { SignalItem } from "@/lib/data";

export function DashboardSection({
  title,
  description,
  icon: Icon,
  href,
  items,
}: {
  title: string;
  description: string;
  icon: LucideIcon;
  href: string;
  items: SignalItem[];
}) {
  return (
    <section className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <div className="flex size-9 items-center justify-center rounded-md bg-primary text-primary-foreground">
            <Icon className="size-4" />
          </div>
          <div>
            <h2 className="text-xl font-semibold tracking-normal">{title}</h2>
            <p className="text-sm text-muted-foreground">{description}</p>
          </div>
        </div>
        <Button asChild variant="outline" size="sm">
          <Link href={href}>
            View
            <ArrowRight className="size-4" />
          </Link>
        </Button>
      </div>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {items.map((item) => (
          <SignalCard key={item.name} item={item} />
        ))}
      </div>
    </section>
  );
}

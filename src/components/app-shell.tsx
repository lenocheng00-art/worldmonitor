"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Eye,
  FlaskConical,
  GitBranch,
  Inbox,
  LayoutDashboard,
  RadioTower,
  Sparkles,
  Users,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const researchItems = [
  { href: "/", label: "Overview", icon: LayoutDashboard },
  { href: "/signal-monitor", label: "Signal Monitor", icon: RadioTower },
  { href: "/signal-inbox", label: "Signal Inbox", icon: Inbox },
  { href: "/logic-chains", label: "Logic Chains", icon: GitBranch },
];

const decisionItems = [
  { href: "/committee", label: "Investment Committee", icon: Users },
  { href: "/backtest-lab", label: "Backtest Lab", icon: FlaskConical },
  { href: "/watchlist", label: "Watchlist", icon: Eye },
];

const navGroups = [
  { label: "Research", items: researchItems },
  { label: "Decision", items: decisionItems },
];

const mobileItems = [...researchItems, ...decisionItems];

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <div className="min-h-screen bg-background">
      <aside className="fixed inset-y-0 left-0 z-20 hidden w-64 border-r bg-card lg:block">
        <div className="flex h-16 items-center gap-3 border-b px-5">
          <div className="flex size-10 items-center justify-center rounded-md bg-primary text-primary-foreground">
            <Sparkles className="size-5" />
          </div>
          <div>
            <div className="text-sm font-semibold">WorldMonitor</div>
            <div className="text-xs text-muted-foreground">V1.8.1 · Production Burn-in</div>
          </div>
        </div>

        <div className="space-y-5 p-3">
          {navGroups.map((group) => (
            <div key={group.label}>
              <div className="mb-2 px-3 text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                {group.label}
              </div>
              <nav className="space-y-1">
                {group.items.map((item) => {
                  const active = isActive(pathname, item.href);
                  return (
                    <Button
                      key={item.href}
                      asChild
                      variant="ghost"
                      className={cn(
                        "w-full justify-start",
                        active && "bg-muted font-semibold text-primary",
                      )}
                    >
                      <Link href={item.href}>
                        <item.icon className="size-4" />
                        {item.label}
                      </Link>
                    </Button>
                  );
                })}
              </nav>
            </div>
          ))}
        </div>

        <div className="absolute inset-x-4 bottom-4 rounded-md border bg-muted/40 px-3 py-3 text-xs leading-5 text-muted-foreground">
          Signal → Logic Chain → Committee → Backtest → Watchlist
        </div>
      </aside>

      <div className="lg:pl-64">
        <header className="sticky top-0 z-10 border-b bg-background/95 backdrop-blur">
          <div className="flex min-h-16 items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
            <Link href="/" className="flex items-center gap-3 lg:hidden">
              <div className="flex size-9 items-center justify-center rounded-md bg-primary text-primary-foreground">
                <Sparkles className="size-4" />
              </div>
              <div>
                <div className="text-sm font-semibold">WorldMonitor</div>
                <div className="text-[11px] text-muted-foreground">V1.8.1 · Production Burn-in</div>
              </div>
            </Link>
            <div className="hidden text-xs text-muted-foreground lg:block">
              Research workflow · Supabase cloud state
            </div>
            <span className="ml-auto rounded-md border border-emerald-200 bg-emerald-50 px-2 py-1 text-xs font-medium text-emerald-800">
              Live
            </span>
          </div>
          <nav className="flex gap-1 overflow-x-auto border-t px-3 py-2 lg:hidden" aria-label="Mobile navigation">
            {mobileItems.map((item) => (
              <Button
                key={item.href}
                asChild
                variant="ghost"
                size="sm"
                className={cn("shrink-0", isActive(pathname, item.href) && "bg-muted font-semibold text-primary")}
              >
                <Link href={item.href}>
                  <item.icon className="size-4" />
                  {item.label}
                </Link>
              </Button>
            ))}
          </nav>
        </header>
        <main className="mx-auto w-full max-w-[1540px] px-4 py-6 sm:px-6 lg:px-8 lg:py-8">{children}</main>
      </div>
    </div>
  );
}

function isActive(pathname: string, href: string) {
  return href === "/" ? pathname === "/" : pathname.startsWith(href);
}

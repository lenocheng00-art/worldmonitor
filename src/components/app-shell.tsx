"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BarChart3,
  Boxes,
  ClipboardList,
  FlaskConical,
  GitBranch,
  Inbox,
  Landmark,
  LayoutDashboard,
  RadioTower,
  ReceiptText,
  Settings,
  Sparkles,
  TrendingUp,
  Users,
  WalletCards,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const navItems = [
  { href: "/", label: "Overview", icon: LayoutDashboard },
  { href: "/macro", label: "Macro", icon: TrendingUp },
  { href: "/stocks", label: "Stocks", icon: BarChart3 },
  { href: "/portfolio", label: "Portfolio", icon: WalletCards },
  { href: "/portfolio-overview", label: "Portfolio Overview", icon: ClipboardList },
  { href: "/balance-sheet", label: "Balance Sheet", icon: Landmark },
  { href: "/cash-flow", label: "Cash Flow", icon: ReceiptText },
  { href: "/asset-todos", label: "Asset Todos", icon: ClipboardList },
  { href: "/industry-chains", label: "Industry Chains", icon: Boxes },
  { href: "/logic-chains", label: "Logic Chains", icon: GitBranch },
  { href: "/committee", label: "Committee", icon: Users },
  { href: "/backtest-lab", label: "Backtest Lab", icon: FlaskConical },
  { href: "/signal-inbox", label: "Signal Inbox", icon: Inbox },
  { href: "/alan-chan", label: "Alan Chan", icon: RadioTower },
  { href: "/settings", label: "Settings", icon: Settings },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <div className="min-h-screen bg-background">
      <aside className="fixed inset-y-0 left-0 z-20 hidden w-60 border-r bg-card lg:block">
        <div className="flex h-16 items-center gap-3 border-b px-5">
          <div className="flex size-10 items-center justify-center rounded-md bg-primary text-primary-foreground">
            <Sparkles className="size-5" />
          </div>
          <div>
            <div className="text-sm font-semibold">WorldMonitor</div>
            <div className="text-xs text-muted-foreground">Research operating system</div>
          </div>
        </div>
        <nav className="space-y-1 p-3">
          {navItems.map((item) => {
            const active = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);

            return (
              <Button
                key={item.href}
                asChild
                variant="ghost"
                className={cn("w-full justify-start", active && "bg-muted font-semibold text-primary")}
              >
                <Link href={item.href}>
                  <item.icon className="size-4" />
                  {item.label}
                </Link>
              </Button>
            );
          })}
        </nav>
        <div className="absolute inset-x-3 bottom-4 border-t pt-4 text-xs leading-5 text-muted-foreground">
          Mock research data
          <br />
          Live market adapters preserved
        </div>
      </aside>

      <div className="lg:pl-60">
        <header className="sticky top-0 z-10 border-b bg-background/95 backdrop-blur">
          <div className="flex min-h-16 items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
            <Link href="/" className="flex items-center gap-3 lg:hidden">
              <div className="flex size-9 items-center justify-center rounded-md bg-primary text-primary-foreground">
                <Sparkles className="size-4" />
              </div>
              <span className="text-sm font-semibold">WorldMonitor</span>
            </Link>
            <nav className="hidden min-w-0 flex-1 items-center gap-1 overflow-x-auto lg:flex">
              {navItems.map((item) => (
                <Button
                  key={item.href}
                  asChild
                  variant="ghost"
                  size="sm"
                  className={cn(
                    "shrink-0",
                    (item.href === "/" ? pathname === "/" : pathname.startsWith(item.href)) &&
                      "bg-muted font-semibold text-primary",
                  )}
                >
                  <Link href={item.href}>
                    <item.icon className="size-4" />
                    {item.label}
                  </Link>
                </Button>
              ))}
            </nav>
            <div className="ml-auto flex items-center gap-3 text-xs text-muted-foreground">
              <span className="hidden xl:inline">Research mode</span>
              <span className="rounded-md border border-emerald-200 bg-emerald-50 px-2 py-1 font-medium text-emerald-800">
                Live
              </span>
            </div>
          </div>
          <nav className="flex gap-1 overflow-x-auto border-t px-3 py-2 lg:hidden">
            {navItems.map((item) => (
              <Button key={item.href} asChild variant="ghost" size="sm" className="shrink-0">
                <Link href={item.href}>
                  <item.icon className="size-4" />
                  {item.label}
                </Link>
              </Button>
            ))}
          </nav>
        </header>
        <main className="mx-auto w-full max-w-[1680px] px-4 py-6 sm:px-6 lg:px-8 lg:py-8">{children}</main>
      </div>
    </div>
  );
}

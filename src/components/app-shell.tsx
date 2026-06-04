import Link from "next/link";
import { BarChart3, Building2, Cpu, LayoutDashboard, Newspaper, Orbit, TrendingUp } from "lucide-react";
import { Button } from "@/components/ui/button";

const navItems = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/ai-infra", label: "AI Infra", icon: Cpu },
  { href: "/ai-labs", label: "AI Labs", icon: Building2 },
  { href: "/space", label: "Space", icon: Orbit },
  { href: "/macro", label: "Macro", icon: TrendingUp },
  { href: "/news", label: "News", icon: Newspaper },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-background">
      <aside className="fixed inset-y-0 left-0 z-20 hidden w-64 border-r bg-card lg:block">
        <div className="flex h-16 items-center gap-3 border-b px-5">
          <div className="flex size-10 items-center justify-center rounded-md bg-primary text-primary-foreground">
            <BarChart3 className="size-5" />
          </div>
          <div>
            <div className="text-sm font-semibold">WorldMonitor</div>
            <div className="text-xs text-muted-foreground">Live market desk</div>
          </div>
        </div>
        <nav className="space-y-1 p-3">
          {navItems.map((item) => (
            <Button key={item.href} asChild variant="ghost" className="w-full justify-start">
              <Link href={item.href}>
                <item.icon className="size-4" />
                {item.label}
              </Link>
            </Button>
          ))}
        </nav>
      </aside>

      <div className="lg:pl-64">
        <header className="sticky top-0 z-10 border-b bg-background/95 backdrop-blur">
          <div className="flex min-h-16 items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
            <Link href="/" className="flex items-center gap-3 lg:hidden">
              <div className="flex size-9 items-center justify-center rounded-md bg-primary text-primary-foreground">
                <BarChart3 className="size-4" />
              </div>
              <span className="text-sm font-semibold">WorldMonitor</span>
            </Link>
            <nav className="hidden flex-1 items-center gap-1 lg:flex">
              {navItems.map((item) => (
                <Button key={item.href} asChild variant="ghost" size="sm">
                  <Link href={item.href}>
                    <item.icon className="size-4" />
                    {item.label}
                  </Link>
                </Button>
              ))}
            </nav>
            <div className="ml-auto flex items-center gap-3 text-xs text-muted-foreground">
              <span className="hidden sm:inline">Environment</span>
              <span className="rounded-md border bg-card px-2 py-1 font-medium text-foreground">Live</span>
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
        <main className="px-4 py-6 sm:px-6 lg:px-8 lg:py-8">{children}</main>
      </div>
    </div>
  );
}

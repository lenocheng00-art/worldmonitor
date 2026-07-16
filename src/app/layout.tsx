import type { Metadata } from "next";
import "./globals.css";
import { AppShell } from "@/components/app-shell";
import { DecisionLoopProvider } from "@/lib/decision-loop-store";

export const metadata: Metadata = {
  title: "WorldMonitor V1.8 — Signal Operations",
  description: "Signal-to-decision research workflow for signals, logic chains, committee review, backtests, and watchlists.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>
        <DecisionLoopProvider>
          <AppShell>{children}</AppShell>
        </DecisionLoopProvider>
      </body>
    </html>
  );
}

import type { Metadata } from "next";
import "./globals.css";
import { AppShell } from "@/components/app-shell";
import { DecisionLoopProvider } from "@/lib/decision-loop-store";

export const metadata: Metadata = {
  title: "WorldMonitor Research OS",
  description: "An investment research operating system for macro, equities, industry chains, and signals.",
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

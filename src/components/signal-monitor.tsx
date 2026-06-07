"use client";

import { Suspense } from "react";
import { SignalInbox } from "@/components/signal-inbox";

export function SignalMonitor() {
  return (
    <Suspense fallback={<div className="h-96 animate-pulse rounded-lg border bg-muted/30" />}>
      <SignalInbox />
    </Suspense>
  );
}

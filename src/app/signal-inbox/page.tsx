import { Suspense } from "react";
import { PageHeader } from "@/components/page-header";
import { SignalInbox } from "@/components/signal-inbox";

export default function SignalInboxPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Research ingestion layer"
        title="Signal Inbox"
        description="Prioritize incoming research, attach monitoring rules, and promote validated signals into ID-linked Logic Chains."
      />
      <Suspense fallback={<div className="h-96 animate-pulse rounded-lg border bg-muted/30" />}>
        <SignalInbox />
      </Suspense>
    </div>
  );
}

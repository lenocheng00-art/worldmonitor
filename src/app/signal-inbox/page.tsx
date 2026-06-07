import { PageHeader } from "@/components/page-header";
import { SignalInbox } from "@/components/signal-inbox";

export default function SignalInboxPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Research ingestion layer"
        title="Signal Inbox"
        description="Normalize member research into tracked companies, industry chains, catalysts, validation data, and monitoring schedules."
      />
      <SignalInbox />
    </div>
  );
}


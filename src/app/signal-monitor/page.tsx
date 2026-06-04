import { Activity } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { SignalMonitor } from "@/components/signal-monitor";

export default function SignalMonitorPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-start gap-4">
        <div className="mt-1 flex size-11 shrink-0 items-center justify-center rounded-md bg-primary text-primary-foreground">
          <Activity className="size-5" />
        </div>
        <PageHeader
          eyebrow="Evidence-driven tracking"
          title="Signal Monitor"
          description="Track signal status, latest updates, evidence, risk level, confidence, and monitoring rules."
        />
      </div>
      <SignalMonitor />
    </div>
  );
}

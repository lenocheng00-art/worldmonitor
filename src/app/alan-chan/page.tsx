import { RadioTower } from "lucide-react";
import { AlanChanSignals } from "@/components/alan-chan-signals";
import { PageHeader } from "@/components/page-header";

export default function AlanChanPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-start gap-4">
        <div className="mt-1 flex size-11 shrink-0 items-center justify-center rounded-md bg-primary text-primary-foreground">
          <RadioTower className="size-5" />
        </div>
        <PageHeader
          eyebrow="Manual member-post signal tracker"
          title="Alan Chan Signals"
          description="Paste members-only post text, extract investable signals, and track the setup locally on this device."
        />
      </div>
      <AlanChanSignals />
    </div>
  );
}

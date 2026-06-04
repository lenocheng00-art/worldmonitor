import { Orbit } from "lucide-react";
import { CompanyPage } from "@/components/company-page";
import { marketGroups } from "@/lib/data";

export default function SpacePage() {
  return (
    <CompanyPage
      eyebrow="Launch and orbital networks"
      title="Space"
      description="Track SpaceX, Starlink, and Rocket Lab across launch cadence, revenue momentum, and operational notes."
      icon={Orbit}
      items={marketGroups.space}
    />
  );
}

import { PageHeader } from "@/components/page-header";
import { PortfolioAssetDetail } from "@/components/portfolio-asset-detail";

export default async function PortfolioAssetDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Portfolio Register detail"
        title="Asset Detail"
        description="Inspect a manually maintained asset record, valuation basis, freshness, and research links."
      />
      <PortfolioAssetDetail assetId={id} />
    </div>
  );
}

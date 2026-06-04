import { Newspaper } from "lucide-react";
import { NewsFeed } from "@/components/news-feed";
import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { newsItems } from "@/lib/data";

export default function NewsPage() {
  const aiCount = newsItems.filter((item) => item.category === "AI").length;
  const spaceCount = newsItems.filter((item) => item.category === "Space").length;

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Live intelligence stream"
        title="News"
        description="Latest AI news and latest space news, currently backed by mock editorial data."
      />
      <div className="flex flex-wrap gap-2">
        <Badge variant="secondary">AI: {aiCount}</Badge>
        <Badge variant="outline">Space: {spaceCount}</Badge>
        <Badge variant="outline">Mock data</Badge>
      </div>
      <div className="flex items-center gap-3">
        <div className="flex size-9 items-center justify-center rounded-md bg-primary text-primary-foreground">
          <Newspaper className="size-4" />
        </div>
        <h2 className="text-lg font-semibold">Latest Signals</h2>
      </div>
      <NewsFeed items={newsItems} />
    </div>
  );
}

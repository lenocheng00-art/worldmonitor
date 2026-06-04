import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import type { NewsItem } from "@/lib/data";

export function NewsFeed({ items }: { items: NewsItem[] }) {
  return (
    <div className="grid gap-3 lg:grid-cols-2">
      {items.map((item) => (
        <Card key={item.id}>
          <CardContent className="space-y-3 p-5">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant={item.category === "AI" ? "secondary" : "outline"}>{item.category}</Badge>
              <span className="text-xs text-muted-foreground">{item.source}</span>
              <span className="text-xs text-muted-foreground">{item.publishedAt}</span>
            </div>
            <div className="space-y-2">
              <h3 className="text-base font-semibold leading-6 tracking-normal">{item.title}</h3>
              <p className="text-sm leading-6 text-muted-foreground">{item.summary}</p>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

import { format } from "date-fns";
import { Calendar, ExternalLink } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import type { ArticleWithMetadata, CategoryWithKeywords } from "@shared/schema";

interface TimelineViewProps {
  articles: ArticleWithMetadata[];
  categories: CategoryWithKeywords[];
}

interface GroupedArticles {
  date: string;
  articles: ArticleWithMetadata[];
}

export function TimelineView({ articles, categories }: TimelineViewProps) {
  const getCategoryName = (categoryId: string) => {
    return categories.find((c) => c.id === categoryId)?.name || "알 수 없음";
  };

  const groupedByDate = articles.reduce((acc, article) => {
    const dateKey = format(new Date(article.crawledDate), "yyyy-MM-dd");
    
    if (!acc[dateKey]) {
      acc[dateKey] = [];
    }
    acc[dateKey].push(article);
    return acc;
  }, {} as Record<string, ArticleWithMetadata[]>);

  const sortedGroups: GroupedArticles[] = Object.entries(groupedByDate)
    .map(([date, articles]) => ({ date, articles }))
    .sort((a, b) => b.date.localeCompare(a.date));

  if (sortedGroups.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        검색 결과가 없습니다.
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {sortedGroups.map((group) => (
        <div key={group.date} className="relative">
          <div className="sticky top-0 z-10 bg-background/95 backdrop-blur-sm py-3 mb-4 border-b">
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4 text-muted-foreground" />
              <h3 className="text-lg font-semibold">
                {format(new Date(group.date), "yyyy년 MM월 dd일")}
              </h3>
              <Badge variant="secondary" className="ml-2">
                {group.articles.length}건
              </Badge>
            </div>
          </div>

          <div className="space-y-4 relative before:absolute before:left-6 before:top-0 before:bottom-0 before:w-px before:bg-border">
            {group.articles.map((article, index) => (
              <div key={article.id} className="relative pl-14">
                <div
                  className="absolute left-4 top-6 w-4 h-4 rounded-full bg-primary border-4 border-background"
                  data-testid={`timeline-dot-${article.id}`}
                />

                <Card className="p-4 hover-elevate" data-testid={`timeline-article-${article.id}`}>
                  <div className="space-y-2">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1">
                        {article.categoryId && (
                          <div className="flex items-center gap-2 mb-1">
                            <Badge variant="outline" data-testid={`timeline-category-${article.id}`}>
                              {getCategoryName(article.categoryId)}
                            </Badge>
                          </div>
                        )}
                        <a
                          href={article.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-base font-medium hover:text-primary transition-colors inline-flex items-center gap-1 group"
                          data-testid={`timeline-title-${article.id}`}
                        >
                          {article.title}
                          <ExternalLink className="h-3 w-3 opacity-0 group-hover:opacity-100 transition-opacity" />
                        </a>
                      </div>
                    </div>

                    {article.summary && (
                      <p
                        className="text-sm text-muted-foreground line-clamp-3"
                        data-testid={`timeline-summary-${article.id}`}
                      >
                        {article.summary}
                      </p>
                    )}
                  </div>
                </Card>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

import { ArticleWithMetadata } from "@shared/schema";
import { ExternalLink, RefreshCcw } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { useState } from "react";
import { AlternativeArticlesDialog } from "./alternative-articles-dialog";

interface ArticleCardProps {
  article: ArticleWithMetadata;
  deleteMode: boolean;
  isSelected: boolean;
  onToggleSelect: () => void;
  showBorder: boolean;
}

export function ArticleCard({
  article,
  deleteMode,
  isSelected,
  onToggleSelect,
  showBorder,
}: ArticleCardProps) {
  const [showAlternatives, setShowAlternatives] = useState(false);

  return (
    <>
      <div
        className={`flex items-start gap-6 py-6 hover-elevate transition-all duration-200 ${
          showBorder ? "border-b border-border" : ""
        }`}
        data-testid={`card-article-${article.id}`}
      >
        {/* Checkbox (only visible in delete mode) */}
        {deleteMode && (
          <div className="pt-1">
            <Checkbox
              checked={isSelected}
              onCheckedChange={onToggleSelect}
              data-testid={`checkbox-article-${article.id}`}
            />
          </div>
        )}

        {/* Article Content */}
        <div className="flex-1 min-w-0 space-y-3">
          {/* Title */}
          <a
            href={article.url}
            target="_blank"
            rel="noopener noreferrer"
            className="group inline-flex items-center gap-2 font-medium leading-tight hover:underline"
            data-testid={`link-article-${article.id}`}
          >
            <span className="break-words">{article.title}</span>
            <ExternalLink className="h-3.5 w-3.5 flex-shrink-0 text-muted-foreground group-hover:text-foreground transition-colors" />
          </a>

          {/* Summary (only if exists and not empty) */}
          {article.summary && article.summary.trim() && (
            <p className="text-sm leading-relaxed text-muted-foreground">
              {article.summary}
            </p>
          )}
        </div>

        {/* Replace Article Button */}
        {!deleteMode && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowAlternatives(true)}
            data-testid={`button-replace-${article.id}`}
          >
            <RefreshCcw className="h-4 w-4 mr-2" />
            다른 기사 보기
          </Button>
        )}
      </div>

      <AlternativeArticlesDialog
        articleId={article.id}
        open={showAlternatives}
        onOpenChange={setShowAlternatives}
      />
    </>
  );
}

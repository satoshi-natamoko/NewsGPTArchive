import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { ExternalLink, Loader2, RefreshCcw } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { format } from "date-fns";
import { ko } from "date-fns/locale";

interface AlternativeArticlesDialogProps {
  articleId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface NaverNewsItem {
  title: string;
  link: string;
  description: string;
  pubDate: string;
}

interface AlternativesResponse {
  keyword: string;
  articles: NaverNewsItem[];
}

export function AlternativeArticlesDialog({
  articleId,
  open,
  onOpenChange,
}: AlternativeArticlesDialogProps) {
  const { toast } = useToast();
  const [selectedArticle, setSelectedArticle] = useState<NaverNewsItem | null>(null);

  // Fetch alternative articles
  const { data, isLoading, error } = useQuery<AlternativesResponse>({
    queryKey: ["/api/articles", articleId, "alternatives"],
    enabled: open,
  });

  // Replace article mutation
  const replaceMutation = useMutation({
    mutationFn: async (article: NaverNewsItem) => {
      return apiRequest("PUT", `/api/articles/${articleId}/replace`, {
        title: article.title,
        description: article.description,
        url: article.link,
        publishedDate: article.pubDate,
      });
    },
    onSuccess: () => {
      toast({
        title: "기사 교체 완료",
        description: "선택한 기사로 성공적으로 교체되었습니다.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/articles"] });
      onOpenChange(false);
    },
    onError: (error) => {
      toast({
        title: "기사 교체 실패",
        description: error instanceof Error ? error.message : "알 수 없는 오류가 발생했습니다.",
        variant: "destructive",
      });
    },
  });

  const handleReplace = () => {
    if (selectedArticle) {
      replaceMutation.mutate(selectedArticle);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[80vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>다른 기사 선택</DialogTitle>
          <DialogDescription>
            {data?.keyword && `"${data.keyword}" 키워드로 검색된 다른 기사들입니다.`}
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto space-y-4 pr-2">
          {isLoading && (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          )}

          {error && (
            <div className="text-center py-8 text-destructive">
              {error instanceof Error ? error.message : "기사를 불러오는데 실패했습니다."}
            </div>
          )}

          {data?.articles && data.articles.length === 0 && (
            <div className="text-center py-8 text-muted-foreground">
              대체 가능한 기사가 없습니다.
            </div>
          )}

          {data?.articles.map((article, index) => (
            <div
              key={index}
              className={`p-4 rounded-md border transition-colors cursor-pointer hover-elevate ${
                selectedArticle === article
                  ? "border-primary bg-accent"
                  : "border-border"
              }`}
              onClick={() => setSelectedArticle(article)}
              data-testid={`card-alternative-${index}`}
            >
              <div className="space-y-2">
                {/* Title with link */}
                <div className="flex items-start gap-2">
                  <h4 className="font-medium flex-1 leading-tight">
                    {article.title}
                  </h4>
                  <a
                    href={article.link}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-muted-foreground hover:text-foreground transition-colors"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <ExternalLink className="h-4 w-4" />
                  </a>
                </div>

                {/* Description */}
                <p className="text-sm text-muted-foreground leading-relaxed">
                  {article.description}
                </p>

                {/* Published Date */}
                <p className="text-xs text-muted-foreground">
                  {format(new Date(article.pubDate), "yyyy년 M월 d일 HH:mm", { locale: ko })}
                </p>
              </div>
            </div>
          ))}
        </div>

        <div className="flex justify-end gap-2 pt-4 border-t">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            data-testid="button-cancel"
          >
            취소
          </Button>
          <Button
            onClick={handleReplace}
            disabled={!selectedArticle || replaceMutation.isPending}
            data-testid="button-confirm-replace"
          >
            {replaceMutation.isPending ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                교체 중...
              </>
            ) : (
              <>
                <RefreshCcw className="h-4 w-4 mr-2" />
                교체하기
              </>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

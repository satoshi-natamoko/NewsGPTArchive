import { useState } from "react";
import { CategoryWithArticles, ArticleWithMetadata } from "@shared/schema";
import { ArticleCard } from "@/components/article-card";
import { Button } from "@/components/ui/button";
import { Loader2, FileX, Trash2 } from "lucide-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { format, isSameDay } from "date-fns";

interface ArticleListProps {
  categories: CategoryWithArticles[];
  isLoading: boolean;
  deleteMode: boolean;
  selectedDate?: Date;
  availableDates: string[];
}

export function ArticleList({
  categories,
  isLoading,
  deleteMode,
  selectedDate,
  availableDates,
}: ArticleListProps) {
  const [selectedArticles, setSelectedArticles] = useState<Set<string>>(
    new Set()
  );
  const [showConfirmDelete, setShowConfirmDelete] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const deleteArticlesMutation = useMutation({
    mutationFn: async (articleIds: string[]) => {
      return await apiRequest("DELETE", "/api/articles/bulk", { articleIds });
    },
    onSuccess: () => {
      toast({
        title: "기사 삭제 완료",
        description: `${selectedArticles.size}개의 기사가 삭제되었습니다.`,
      });
      setSelectedArticles(new Set());
      queryClient.invalidateQueries({ queryKey: ["/api/articles"] });
      queryClient.invalidateQueries({ queryKey: ["/api/articles/dates"] });
      setShowConfirmDelete(false);
    },
    onError: (error: any) => {
      toast({
        title: "삭제 실패",
        description: error.message || "기사 삭제 중 오류가 발생했습니다.",
        variant: "destructive",
      });
    },
  });

  const handleToggleArticle = (articleId: string) => {
    const newSelected = new Set(selectedArticles);
    if (newSelected.has(articleId)) {
      newSelected.delete(articleId);
    } else {
      newSelected.add(articleId);
    }
    setSelectedArticles(newSelected);
  };

  const handleDeleteSelected = () => {
    if (selectedArticles.size === 0) {
      toast({
        title: "선택된 기사 없음",
        description: "삭제할 기사를 먼저 선택하세요.",
      });
      return;
    }
    setShowConfirmDelete(true);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (categories.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <FileX className="h-16 w-16 text-muted-foreground mb-4" />
        <h3 className="text-lg font-medium mb-2" data-testid="text-no-articles">
          아직 크롤링된 기사가 없습니다
        </h3>
        <p className="text-sm text-muted-foreground">
          관리 메뉴에서 크롤링을 시작하세요
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-12">
      {/* Delete Mode Actions */}
      {deleteMode && (
        <div className="flex items-center justify-between bg-card border border-card-border rounded-md p-4">
          <div className="text-sm text-muted-foreground">
            {selectedArticles.size}개 선택됨
          </div>
          <Button
            variant="destructive"
            size="sm"
            onClick={handleDeleteSelected}
            disabled={
              selectedArticles.size === 0 || deleteArticlesMutation.isPending
            }
            data-testid="button-delete-selected"
          >
            {deleteArticlesMutation.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
            ) : (
              <Trash2 className="h-4 w-4 mr-2" />
            )}
            선택 삭제
          </Button>
        </div>
      )}

      {/* Category Sections */}
      {categories.map((category) => (
        <section key={category.id} className="space-y-6">
          {/* Category Header */}
          <div className="flex items-center gap-6">
            <h2
              className="text-xl font-semibold"
              data-testid={`text-category-${category.name}`}
            >
              {category.name}
            </h2>
            <div className="h-px flex-1 bg-border" />
          </div>

          {/* Articles */}
          {category.articles.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4">
              {(() => {
                // Check if selected date is today or future and hasn't been crawled yet
                if (selectedDate) {
                  const today = new Date();
                  today.setHours(0, 0, 0, 0);
                  const selected = new Date(selectedDate);
                  selected.setHours(0, 0, 0, 0);
                  
                  // If selected date is today or future
                  const isTodayOrFuture = selected >= today;
                  const selectedStr = format(selectedDate, "yyyy-MM-dd");
                  const hasData = availableDates.includes(selectedStr);
                  
                  // Show "검색 진행 전" if:
                  // 1. Selected date is today or future and hasn't been crawled
                  // 2. Selected date is today and data was deleted (not in availableDates)
                  if (isTodayOrFuture && !hasData) {
                    return "검색 진행 전";
                  }
                }
                return "최근 3일 기사 없음";
              })()}
            </p>
          ) : (
            <div className="space-y-0">
              {category.articles.map((article, index) => (
                <ArticleCard
                  key={article.id}
                  article={article}
                  deleteMode={deleteMode}
                  isSelected={selectedArticles.has(article.id)}
                  onToggleSelect={() => handleToggleArticle(article.id)}
                  showBorder={index < category.articles.length - 1}
                />
              ))}
            </div>
          )}
        </section>
      ))}

      {/* Confirm Delete Dialog */}
      <ConfirmDialog
        open={showConfirmDelete}
        onOpenChange={setShowConfirmDelete}
        title="기사 삭제"
        description={`선택한 ${selectedArticles.size}개의 기사를 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.`}
        onConfirm={() =>
          deleteArticlesMutation.mutate(Array.from(selectedArticles))
        }
        confirmText="삭제"
        cancelText="취소"
        variant="destructive"
      />
    </div>
  );
}

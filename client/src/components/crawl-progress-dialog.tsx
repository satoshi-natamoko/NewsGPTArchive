import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import { CheckCircle2, Loader2, XCircle, AlertCircle, MinusCircle, Minimize2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useCrawlProgress, type CategoryProgress } from "@/hooks/use-crawl-progress";
import { useEffect } from "react";

interface CrawlProgressDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onComplete?: () => void;
  onMinimize?: () => void;
}

function getCategoryStatusIcon(status: CategoryProgress["status"]) {
  switch (status) {
    case "completed":
      return <CheckCircle2 className="h-5 w-5 text-green-500" data-testid="icon-completed" />;
    case "processing":
      return <Loader2 className="h-5 w-5 animate-spin text-blue-500" data-testid="icon-processing" />;
    case "error":
      return <CheckCircle2 className="h-5 w-5 text-green-500" data-testid="icon-error" />;
    case "skipped":
      return <MinusCircle className="h-5 w-5 text-muted-foreground" data-testid="icon-skipped" />;
    case "pending":
    default:
      return <AlertCircle className="h-5 w-5 text-muted-foreground" data-testid="icon-pending" />;
  }
}

export function CrawlProgressDialog({ open, onOpenChange, onComplete, onMinimize }: CrawlProgressDialogProps) {
  const { isConnected, categoryProgress, isComplete, connect, disconnect } = useCrawlProgress();

  useEffect(() => {
    if (open) {
      connect();
    }
    // Don't disconnect when dialog closes - keep WebSocket alive during crawling
    // Only disconnect when crawl is complete or component unmounts
  }, [open, connect]);

  useEffect(() => {
    if (isComplete && onComplete) {
      // Wait a bit before closing to show final state
      const timer = setTimeout(() => {
        onComplete();
        // Disconnect after completing
        setTimeout(() => {
          disconnect();
        }, 100);
      }, 1500);
      return () => clearTimeout(timer);
    }
  }, [isComplete, disconnect]);  // onComplete를 dependency에서 제거하여 무한 루프 방지

  const categories = Array.from(categoryProgress.values());
  const totalCategories = categories.length;
  const completedCategories = categories.filter(
    (c) => c.status === "completed" || c.status === "error" || c.status === "skipped"
  ).length;
  const progressPercentage = totalCategories > 0 ? (completedCategories / totalCategories) * 100 : 0;

  const handleMinimize = () => {
    if (onMinimize && !isComplete) {
      onMinimize();
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent 
        className="max-w-2xl max-h-[80vh] overflow-hidden flex flex-col" 
        data-testid="dialog-crawl-progress"
        onInteractOutside={(e) => {
          // 크롤링 진행 중에는 외부 클릭으로 닫히지 않도록
          if (!isComplete) {
            e.preventDefault();
          }
        }}
      >
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              {!isComplete && <Loader2 className="h-5 w-5 animate-spin" />}
              크롤링 진행 상황
            </div>
            {!isComplete && onMinimize && (
              <Button
                variant="ghost"
                size="icon"
                onClick={handleMinimize}
                className="h-8 w-8"
                data-testid="button-minimize"
              >
                <Minimize2 className="h-4 w-4" />
              </Button>
            )}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 flex-1 overflow-auto">
          {/* Overall progress */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">전체 진행률</span>
              <span className="font-mono" data-testid="text-progress">
                {completedCategories} / {totalCategories}
              </span>
            </div>
            <Progress value={progressPercentage} className="h-2" data-testid="progress-bar" />
          </div>

          {/* Connection status */}
          {!isConnected && totalCategories === 0 && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              연결 중...
            </div>
          )}

          {/* Category list */}
          <div className="space-y-2">
            {categories.map((category) => (
              <div
                key={category.id}
                className="border rounded-lg p-3 space-y-1"
                data-testid={`category-${category.id}`}
              >
                <div className="flex items-start gap-2">
                  <div className="mt-0.5">{getCategoryStatusIcon(category.status)}</div>
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-sm" data-testid={`category-name-${category.id}`}>
                      {category.name}
                    </div>
                    <div className="text-sm text-muted-foreground" data-testid={`category-message-${category.id}`}>
                      {category.message}
                    </div>
                    {category.articleTitle && (
                      <div className="text-xs text-muted-foreground mt-1 truncate" data-testid={`category-article-${category.id}`}>
                        📰 {category.articleTitle}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Completion message */}
          {isComplete && (
            <div className="flex items-center gap-2 p-3 bg-green-500/10 text-green-600 dark:text-green-400 rounded-lg" data-testid="message-complete">
              <CheckCircle2 className="h-5 w-5" />
              <span className="font-medium">크롤링 완료!</span>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  X,
  Play,
  Settings,
  Trash2,
  Archive,
  Loader2,
  Download,
  Clock,
  Bell,
  BarChart3,
} from "lucide-react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { KeywordManager } from "@/components/keyword-manager";
import { ExportDialog } from "@/components/export-dialog";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { SchedulerSettingsComponent } from "@/components/scheduler-settings";
import { NotificationSettingsComponent } from "@/components/notification-settings";
import { CrawlProgressDialog } from "@/components/crawl-progress-dialog";
import { format } from "date-fns";

interface ManagementPanelProps {
  isOpen: boolean;
  onClose: () => void;
  deleteMode: boolean;
  setDeleteMode: (mode: boolean) => void;
  selectedDate?: Date;
}

export function ManagementPanel({
  isOpen,
  onClose,
  deleteMode,
  setDeleteMode,
  selectedDate: selectedDateProp,
}: ManagementPanelProps) {
  // Format selected date for archive deletion
  const selectedDate = selectedDateProp ? format(selectedDateProp, "yyyy-MM-dd") : "";
  const [showAdvancedSettings, setShowAdvancedSettings] = useState(false);
  const [showConfirmCrawl, setShowConfirmCrawl] = useState(false);
  const [showConfirmArchiveDelete, setShowConfirmArchiveDelete] = useState(false);
  const [showKeywordManager, setShowKeywordManager] = useState(false);
  const [showExportDialog, setShowExportDialog] = useState(false);
  const [showSchedulerSettings, setShowSchedulerSettings] = useState(false);
  const [showNotificationSettings, setShowNotificationSettings] = useState(false);
  const [showCrawlProgress, setShowCrawlProgress] = useState(false);
  const [isCrawling, setIsCrawling] = useState(false); // 크롤링 진행 중인지 추적
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Start crawling mutation
  const crawlMutation = useMutation({
    mutationFn: async (deleteExisting: boolean) => {
      return await apiRequest("POST", "/api/crawl", { deleteExisting });
    },
    onSuccess: () => {
      // Don't show toast here - progress dialog will show completion
      // Just invalidate queries
      queryClient.invalidateQueries({ queryKey: ["/api/articles"] });
      queryClient.invalidateQueries({ queryKey: ["/api/articles/dates"] });
      setShowConfirmCrawl(false);
    },
    onError: (error: any) => {
      toast({
        title: "크롤링 실패",
        description: error.message || "크롤링 중 오류가 발생했습니다.",
        variant: "destructive",
      });
      setShowCrawlProgress(false);
      setIsCrawling(false);
    },
  });

  // Delete archive mutation
  const deleteArchiveMutation = useMutation({
    mutationFn: async (date: string) => {
      return await apiRequest("DELETE", `/api/articles/date/${date}`, null);
    },
    onSuccess: () => {
      toast({
        title: "아카이브 삭제 완료",
        description: "선택한 날짜의 아카이브가 삭제되었습니다.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/articles"] });
      queryClient.invalidateQueries({ queryKey: ["/api/articles/dates"] });
      setShowConfirmArchiveDelete(false);
      onClose();
    },
    onError: (error: any) => {
      toast({
        title: "삭제 실패",
        description: error.message || "아카이브 삭제 중 오류가 발생했습니다.",
        variant: "destructive",
      });
    },
  });

  const handleStartCrawl = async () => {
    // Check if articles exist for today
    const today = new Date().toISOString().split("T")[0];
    
    try {
      const response = await fetch(`/api/articles?date=${today}`);
      const categories = await response.json();
      
      // Check if any category has articles
      const hasArticles = categories.some((cat: any) => cat.articles && cat.articles.length > 0);
      
      if (hasArticles) {
        setShowConfirmCrawl(true);
      } else {
        // Show progress dialog and start crawling
        setShowCrawlProgress(true);
        setIsCrawling(true);
        // Wait a bit for WebSocket to connect before starting crawl
        setTimeout(() => {
          crawlMutation.mutate(false);
        }, 500);
      }
    } catch (error) {
      console.error("Failed to check existing articles:", error);
      // If check fails, just proceed without confirmation
      setShowCrawlProgress(true);
      setIsCrawling(true);
      // Wait a bit for WebSocket to connect before starting crawl
      setTimeout(() => {
        crawlMutation.mutate(false);
      }, 500);
    }
  };

  const handleConfirmCrawl = (deleteExisting: boolean) => {
    setShowCrawlProgress(true);
    setIsCrawling(true);
    // Wait a bit for WebSocket to connect before starting crawl
    setTimeout(() => {
      crawlMutation.mutate(deleteExisting);
    }, 500);
  };

  const handleCrawlProgressComplete = () => {
    setShowCrawlProgress(false);
    setIsCrawling(false);
    toast({
      title: "크롤링 완료",
      description: "뉴스 크롤링이 성공적으로 완료되었습니다.",
    });
    onClose();
  };

  const handleMinimizeCrawlProgress = () => {
    setShowCrawlProgress(false);
    // isCrawling은 true로 유지하여 배지가 표시되도록
  };

  const handleShowCrawlProgress = () => {
    setShowCrawlProgress(true);
  };

  const handleToggleDeleteMode = () => {
    setDeleteMode(!deleteMode);
    if (!deleteMode) {
      toast({
        title: "기사 선택 모드",
        description: "삭제할 기사를 선택하세요.",
      });
    }
    onClose();
  };

  return (
    <>
      {/* 크롤링 진행 중 배지 (최소화 상태일 때만 표시) */}
      {isCrawling && !showCrawlProgress && (
        <motion.div
          initial={{ y: 100, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 100, opacity: 0 }}
          className="fixed bottom-6 right-6 z-50"
        >
          <Button
            onClick={handleShowCrawlProgress}
            className="shadow-lg gap-2"
            size="lg"
            data-testid="button-show-crawl-progress"
          >
            <Loader2 className="h-4 w-4 animate-spin" />
            크롤링 진행 중...
          </Button>
        </motion.div>
      )}

      <AnimatePresence>
        {isOpen && (
          <>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.3 }}
              className="fixed inset-0 z-40 bg-black/20"
              onClick={onClose}
            />

            {/* Panel */}
            <motion.div
              initial={{ x: "100%" }}
              animate={{ x: 0 }}
              exit={{ x: "100%" }}
              transition={{ duration: 0.3, ease: "easeOut" }}
              className="fixed right-0 top-0 z-50 h-screen w-80 bg-card border-l border-card-border shadow-2xl"
            >
              {/* Panel Header */}
              <div className="flex items-center justify-between border-b border-card-border px-6 py-4">
                <h2 className="text-lg font-medium" data-testid="text-management-title">
                  메뉴
                </h2>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={onClose}
                  data-testid="button-close-management"
                >
                  <X className="h-5 w-5" />
                </Button>
              </div>

              {/* Panel Content */}
              <div className="flex flex-col gap-2 p-4">
                {/* Crawl Button */}
                <Button
                  className="w-full justify-start gap-3"
                  variant="default"
                  onClick={handleStartCrawl}
                  disabled={crawlMutation.isPending}
                  data-testid="button-start-crawl"
                >
                  {crawlMutation.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Play className="h-4 w-4" />
                  )}
                  크롤링 시작
                </Button>

                {/* Advanced Settings Toggle */}
                <Button
                  className="w-full justify-start gap-3"
                  variant="outline"
                  onClick={() => setShowAdvancedSettings(!showAdvancedSettings)}
                  data-testid="button-advanced-settings"
                >
                  <Settings className="h-4 w-4" />
                  세부설정
                </Button>

                {/* Advanced Settings - Only show when toggled */}
                {showAdvancedSettings && (
                  <div className="flex flex-col gap-2 pl-4 pt-2 border-l-2 border-border ml-2">
                    {/* Keyword Management */}
                    <Button
                      className="w-full justify-start gap-3"
                      variant="ghost"
                      onClick={() => {
                        setShowKeywordManager(true);
                        onClose();
                      }}
                      data-testid="button-keyword-management"
                    >
                      <Settings className="h-4 w-4" />
                      키워드 관리
                    </Button>

                    {/* Scheduler Settings */}
                    <Button
                      className="w-full justify-start gap-3"
                      variant="ghost"
                      onClick={() => {
                        setShowSchedulerSettings(true);
                        onClose();
                      }}
                      data-testid="button-scheduler-settings"
                    >
                      <Clock className="h-4 w-4" />
                      자동 크롤링 설정
                    </Button>

                    {/* Notification Settings */}
                    <Button
                      className="w-full justify-start gap-3"
                      variant="ghost"
                      onClick={() => {
                        setShowNotificationSettings(true);
                        onClose();
                      }}
                      data-testid="button-notification-settings"
                    >
                      <Bell className="h-4 w-4" />
                      알림 설정
                    </Button>

                    {/* Export CSV */}
                    <Button
                      className="w-full justify-start gap-3"
                      variant="ghost"
                      onClick={() => {
                        setShowExportDialog(true);
                        onClose();
                      }}
                      data-testid="button-export"
                    >
                      <Download className="h-4 w-4" />
                      CSV 내보내기
                    </Button>

                    {/* Statistics */}
                    <Link href="/stats">
                      <Button
                        className="w-full justify-start gap-3"
                        variant="ghost"
                        onClick={onClose}
                        data-testid="button-stats"
                      >
                        <BarChart3 className="h-4 w-4" />
                        통계
                      </Button>
                    </Link>

                    {/* Article Selection Delete */}
                    <Button
                      className="w-full justify-start gap-3"
                      variant="ghost"
                      onClick={handleToggleDeleteMode}
                      data-testid="button-toggle-delete-mode"
                    >
                      <Trash2 className="h-4 w-4" />
                      기사 선택 삭제
                    </Button>

                    {/* Archive Delete */}
                    <Button
                      className="w-full justify-start gap-3"
                      variant="ghost"
                      onClick={() => setShowConfirmArchiveDelete(true)}
                      disabled={deleteArchiveMutation.isPending}
                      data-testid="button-delete-archive"
                    >
                      {deleteArchiveMutation.isPending ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Archive className="h-4 w-4" />
                      )}
                      아카이브 삭제
                    </Button>
                  </div>
                )}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Confirm Crawl Dialog */}
      <ConfirmDialog
        open={showConfirmCrawl}
        onOpenChange={setShowConfirmCrawl}
        title="당일 기사 삭제"
        description="오늘 날짜에 이미 크롤링된 기사가 있습니다. 기존 기사를 모두 삭제하고 다시 크롤링하시겠습니까?"
        onConfirm={() => handleConfirmCrawl(true)}
        onCancel={() => {
          setShowConfirmCrawl(false);
          toast({
            title: "크롤링 취소",
            description: "기존 기사가 있어 크롤링을 진행할 수 없습니다.",
          });
        }}
        confirmText="삭제 후 크롤링"
        cancelText="취소"
      />

      {/* Crawl Progress Dialog */}
      <CrawlProgressDialog
        open={showCrawlProgress}
        onOpenChange={setShowCrawlProgress}
        onComplete={handleCrawlProgressComplete}
        onMinimize={handleMinimizeCrawlProgress}
      />

      {/* Confirm Archive Delete Dialog */}
      <ConfirmDialog
        open={showConfirmArchiveDelete}
        onOpenChange={setShowConfirmArchiveDelete}
        title="아카이브 삭제"
        description={`${selectedDate} 날짜의 모든 기사를 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.`}
        onConfirm={() => deleteArchiveMutation.mutate(selectedDate)}
        confirmText="삭제"
        cancelText="취소"
        variant="destructive"
      />

      {/* Keyword Manager Modal */}
      <KeywordManager
        open={showKeywordManager}
        onOpenChange={setShowKeywordManager}
      />

      {/* Export Dialog */}
      <ExportDialog
        open={showExportDialog}
        onOpenChange={setShowExportDialog}
      />

      {/* Scheduler Settings Dialog */}
      <Dialog open={showSchedulerSettings} onOpenChange={setShowSchedulerSettings}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>자동 크롤링 스케줄러</DialogTitle>
          </DialogHeader>
          <SchedulerSettingsComponent />
        </DialogContent>
      </Dialog>

      {/* Notification Settings Dialog */}
      <Dialog open={showNotificationSettings} onOpenChange={setShowNotificationSettings}>
        <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>알림 설정</DialogTitle>
          </DialogHeader>
          <NotificationSettingsComponent />
        </DialogContent>
      </Dialog>
    </>
  );
}

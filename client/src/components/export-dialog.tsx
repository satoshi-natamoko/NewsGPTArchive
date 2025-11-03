import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { DateRangePicker } from "@/components/ui/date-range-picker";
import { Download, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { DateRange } from "react-day-picker";
import { format } from "date-fns";

interface ExportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ExportDialog({ open, onOpenChange }: ExportDialogProps) {
  const [dateRange, setDateRange] = useState<DateRange | undefined>();
  const [isExporting, setIsExporting] = useState(false);
  const { toast } = useToast();

  const handleExport = async () => {
    if (!dateRange?.from || !dateRange?.to) {
      toast({
        title: "날짜 선택 필요",
        description: "시작 날짜와 종료 날짜를 모두 선택해주세요.",
        variant: "destructive",
      });
      return;
    }

    try {
      setIsExporting(true);
      
      const startDate = format(dateRange.from, "yyyy-MM-dd");
      const endDate = format(dateRange.to, "yyyy-MM-dd");
      
      const url = `/api/export?startDate=${startDate}&endDate=${endDate}`;
      const response = await fetch(url, {
        credentials: "include",
      });

      if (!response.ok) {
        throw new Error("Export failed");
      }

      const blob = await response.blob();
      const downloadUrl = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = downloadUrl;
      a.download = `news_export_${startDate}_${endDate}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(downloadUrl);

      toast({
        title: "내보내기 완료",
        description: "CSV 파일이 다운로드되었습니다.",
      });
      
      onOpenChange(false);
      setDateRange(undefined);
    } catch (error: any) {
      console.error("Export failed:", error);
      toast({
        title: "내보내기 실패",
        description: error.message || "CSV 내보내기 중 오류가 발생했습니다.",
        variant: "destructive",
      });
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent data-testid="dialog-export">
        <DialogHeader>
          <DialogTitle data-testid="text-export-title">CSV 내보내기</DialogTitle>
          <DialogDescription>
            내보낼 기사의 날짜 범위를 선택하세요.
          </DialogDescription>
        </DialogHeader>
        
        <div className="grid gap-4 py-4">
          <div className="grid gap-2">
            <Label>날짜 범위</Label>
            <DateRangePicker
              date={dateRange}
              onDateChange={setDateRange}
            />
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isExporting}
            data-testid="button-cancel-export"
          >
            취소
          </Button>
          <Button
            onClick={handleExport}
            disabled={isExporting}
            data-testid="button-confirm-export"
          >
            {isExporting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                내보내는 중...
              </>
            ) : (
              <>
                <Download className="mr-2 h-4 w-4" />
                내보내기
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

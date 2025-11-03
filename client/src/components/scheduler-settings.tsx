import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Clock, Save } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import type { SchedulerSettings } from "@shared/schema";

export function SchedulerSettingsComponent() {
  const { toast } = useToast();
  const [cronExpression, setCronExpression] = useState("");
  const [enabled, setEnabled] = useState(false);
  const [deleteExisting, setDeleteExisting] = useState(false);

  const { data: settings, isLoading } = useQuery<SchedulerSettings>({
    queryKey: ["/api/scheduler"],
  });

  useEffect(() => {
    if (settings) {
      setCronExpression(settings.cronExpression);
      setEnabled(settings.enabled);
      setDeleteExisting(settings.deleteExisting);
    }
  }, [settings]);

  const updateMutation = useMutation({
    mutationFn: async (updates: {
      enabled?: boolean;
      cronExpression?: string;
      deleteExisting?: boolean;
    }) => {
      return await apiRequest("PUT", "/api/scheduler", updates);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/scheduler"] });
      toast({
        title: "설정 저장됨",
        description: "스케줄러 설정이 성공적으로 저장되었습니다.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "오류",
        description: error.message || "설정 저장에 실패했습니다.",
        variant: "destructive",
      });
    },
  });

  const handleSave = () => {
    updateMutation.mutate({
      enabled,
      cronExpression,
      deleteExisting,
    });
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>자동 크롤링 스케줄러</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-muted-foreground">로딩 중...</div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Clock className="h-5 w-5" />
          자동 크롤링 스케줄러
        </CardTitle>
        <CardDescription>
          지정된 시간에 자동으로 뉴스를 크롤링합니다
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Enable/Disable Switch */}
        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <Label htmlFor="scheduler-enabled">스케줄러 활성화</Label>
            <p className="text-sm text-muted-foreground">
              자동 크롤링을 활성화하거나 비활성화합니다
            </p>
          </div>
          <Switch
            id="scheduler-enabled"
            checked={enabled}
            onCheckedChange={setEnabled}
            data-testid="switch-scheduler-enabled"
          />
        </div>

        {/* Cron Expression Input */}
        <div className="space-y-2">
          <Label htmlFor="cron-expression">크론 표현식</Label>
          <Input
            id="cron-expression"
            value={cronExpression}
            onChange={(e) => setCronExpression(e.target.value)}
            placeholder="0 9 * * *"
            data-testid="input-cron-expression"
          />
          <p className="text-sm text-muted-foreground">
            예시: "0 9 * * *" = 매일 오전 9시, "0 */6 * * *" = 6시간마다
          </p>
        </div>

        {/* Delete Existing Checkbox */}
        <div className="flex items-center space-x-2">
          <Checkbox
            id="delete-existing"
            checked={deleteExisting}
            onCheckedChange={(checked) => setDeleteExisting(checked as boolean)}
            data-testid="checkbox-delete-existing"
          />
          <Label
            htmlFor="delete-existing"
            className="text-sm font-normal cursor-pointer"
          >
            크롤링 전 당일 기사 삭제
          </Label>
        </div>

        {/* Last Run Info */}
        {settings?.lastRun && (
          <div className="pt-4 border-t">
            <p className="text-sm text-muted-foreground">
              마지막 실행: {new Date(settings.lastRun).toLocaleString("ko-KR")}
            </p>
          </div>
        )}

        {/* Save Button */}
        <Button
          onClick={handleSave}
          disabled={updateMutation.isPending}
          className="w-full"
          data-testid="button-save-scheduler"
        >
          <Save className="h-4 w-4 mr-2" />
          {updateMutation.isPending ? "저장 중..." : "설정 저장"}
        </Button>
      </CardContent>
    </Card>
  );
}

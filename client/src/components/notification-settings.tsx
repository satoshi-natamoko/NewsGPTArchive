import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { NotificationSettings } from "@shared/schema";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Bell, BellOff } from "lucide-react";
import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export function NotificationSettingsComponent() {
  const { toast } = useToast();

  // Fetch notification settings
  const { data: settings, isLoading } = useQuery<NotificationSettings>({
    queryKey: ["/api/notifications"],
  });

  // Local state for form
  const [enabled, setEnabled] = useState(false);
  const [emailEnabled, setEmailEnabled] = useState(false);
  const [emailAddress, setEmailAddress] = useState("");
  const [slackEnabled, setSlackEnabled] = useState(false);
  const [slackWebhookUrl, setSlackWebhookUrl] = useState("");

  // Initialize form when settings are loaded
  useEffect(() => {
    if (settings) {
      setEnabled(settings.enabled);
      setEmailEnabled(settings.emailEnabled);
      setEmailAddress(settings.emailAddress || "");
      setSlackEnabled(settings.slackEnabled);
      setSlackWebhookUrl(settings.slackWebhookUrl || "");
    }
  }, [settings]);

  // Update settings mutation
  const updateMutation = useMutation({
    mutationFn: async (updates: Partial<NotificationSettings>) => {
      return await apiRequest("PUT", "/api/notifications", updates);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/notifications"] });
      toast({
        title: "알림 설정 저장됨",
        description: "알림 설정이 성공적으로 저장되었습니다.",
      });
    },
    onError: (error: any) => {
      toast({
        variant: "destructive",
        title: "저장 실패",
        description: error.message || "알림 설정 저장에 실패했습니다.",
      });
    },
  });

  const handleSave = () => {
    updateMutation.mutate({
      enabled,
      emailEnabled,
      emailAddress: emailAddress || null,
      slackEnabled,
      slackWebhookUrl: slackWebhookUrl || null,
    });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Master Toggle */}
      <div className="flex items-center justify-between">
        <div className="space-y-0.5">
          <Label className="text-base">알림 활성화</Label>
          <p className="text-sm text-muted-foreground">
            크롤링 완료 시 새 기사 알림 받기
          </p>
        </div>
        <Switch
          checked={enabled}
          onCheckedChange={setEnabled}
          data-testid="switch-notification-enabled"
        />
      </div>

      {/* Email Settings */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>이메일 알림</CardTitle>
              <CardDescription>이메일로 새 기사 알림 받기</CardDescription>
            </div>
            <Switch
              checked={emailEnabled}
              onCheckedChange={setEmailEnabled}
              disabled={!enabled}
              data-testid="switch-email-enabled"
            />
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <Label htmlFor="email-address">이메일 주소</Label>
            <Input
              id="email-address"
              type="email"
              placeholder="your@email.com"
              value={emailAddress}
              onChange={(e) => setEmailAddress(e.target.value)}
              disabled={!enabled || !emailEnabled}
              data-testid="input-email-address"
            />
            <p className="text-xs text-muted-foreground">
              ℹ️ 이메일 전송을 위해서는 SMTP 설정이 필요합니다
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Slack Settings */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Slack 알림</CardTitle>
              <CardDescription>Slack Webhook으로 새 기사 알림 받기</CardDescription>
            </div>
            <Switch
              checked={slackEnabled}
              onCheckedChange={setSlackEnabled}
              disabled={!enabled}
              data-testid="switch-slack-enabled"
            />
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <Label htmlFor="slack-webhook">Slack Webhook URL</Label>
            <Input
              id="slack-webhook"
              type="url"
              placeholder="https://hooks.slack.com/services/..."
              value={slackWebhookUrl}
              onChange={(e) => setSlackWebhookUrl(e.target.value)}
              disabled={!enabled || !slackEnabled}
              data-testid="input-slack-webhook"
            />
            <p className="text-xs text-muted-foreground">
              <a 
                href="https://api.slack.com/messaging/webhooks" 
                target="_blank" 
                rel="noopener noreferrer"
                className="text-primary hover:underline"
              >
                Slack Webhook URL 만들기 →
              </a>
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Save Button */}
      <div className="flex justify-end gap-2">
        <Button
          onClick={handleSave}
          disabled={updateMutation.isPending}
          data-testid="button-save-notifications"
        >
          {updateMutation.isPending ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              저장 중...
            </>
          ) : (
            <>
              {enabled ? <Bell className="mr-2 h-4 w-4" /> : <BellOff className="mr-2 h-4 w-4" />}
              설정 저장
            </>
          )}
        </Button>
      </div>
    </div>
  );
}

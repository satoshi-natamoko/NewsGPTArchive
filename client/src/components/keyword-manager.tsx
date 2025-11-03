import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Loader2 } from "lucide-react";
import { CategoryWithKeywords } from "@shared/schema";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

interface KeywordManagerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function KeywordManager({ open, onOpenChange }: KeywordManagerProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch categories with keywords
  const { data: categories = [], isLoading } = useQuery<CategoryWithKeywords[]>({
    queryKey: ["/api/categories"],
    enabled: open,
  });

  // Local state for editing keywords
  const [editedKeywords, setEditedKeywords] = useState<
    Record<string, string>
  >({});
  const [isDirty, setIsDirty] = useState(false);

  // Initialize edited keywords when data loads
  useEffect(() => {
    if (categories.length > 0 && !isDirty) {
      const initialKeywords: Record<string, string> = {};
      categories.forEach((category) => {
        initialKeywords[category.id] = category.keywords
          .map((k) => k.keyword)
          .join(", ");
      });
      setEditedKeywords(initialKeywords);
    }
  }, [categories, isDirty]);

  // Save keywords mutation
  const saveKeywordsMutation = useMutation({
    mutationFn: async (
      keywordsByCategoryId: Record<string, string[]>
    ) => {
      return await apiRequest("PUT", "/api/keywords", { keywords: keywordsByCategoryId });
    },
    onSuccess: () => {
      toast({
        title: "키워드 저장 완료",
        description: "키워드가 성공적으로 저장되었습니다.",
      });
      setIsDirty(false);
      queryClient.invalidateQueries({ queryKey: ["/api/categories"] });
      onOpenChange(false);
    },
    onError: (error: any) => {
      toast({
        title: "저장 실패",
        description: error.message || "키워드 저장 중 오류가 발생했습니다.",
        variant: "destructive",
      });
    },
  });

  const handleKeywordChange = (categoryId: string, value: string) => {
    setEditedKeywords((prev) => ({
      ...prev,
      [categoryId]: value,
    }));
    setIsDirty(true);
  };

  const handleSave = () => {
    const keywordsByCategoryId: Record<string, string[]> = {};
    
    Object.entries(editedKeywords).forEach(([categoryId, keywordsStr]) => {
      const keywords = keywordsStr
        .split(",")
        .map((k) => k.trim())
        .filter((k) => k.length > 0);
      keywordsByCategoryId[categoryId] = keywords;
    });

    saveKeywordsMutation.mutate(keywordsByCategoryId);
  };

  const handleCancel = () => {
    if (isDirty) {
      const confirmed = window.confirm(
        "변경사항이 저장되지 않았습니다. 정말 닫으시겠습니까?"
      );
      if (!confirmed) return;
    }
    setIsDirty(false);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleCancel}>
      <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle data-testid="text-keyword-manager-title">
            키워드 관리
          </DialogTitle>
          <DialogDescription>
            각 카테고리의 키워드를 수정할 수 있습니다. 키워드는 쉼표(,)로 구분하세요.
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 py-4">
            {categories.map((category) => (
              <div key={category.id} className="space-y-2">
                <Label htmlFor={`keywords-${category.id}`} className="text-base font-medium">
                  {category.name}
                </Label>
                <Textarea
                  id={`keywords-${category.id}`}
                  value={editedKeywords[category.id] || ""}
                  onChange={(e) =>
                    handleKeywordChange(category.id, e.target.value)
                  }
                  placeholder="키워드를 쉼표로 구분하여 입력하세요"
                  className="font-mono text-sm min-h-[120px] resize-none"
                  data-testid={`textarea-keywords-${category.name}`}
                />
                <p className="text-xs text-muted-foreground">
                  {editedKeywords[category.id]?.split(",").filter((k) => k.trim()).length || 0}개 키워드
                </p>
              </div>
            ))}
          </div>
        )}

        <DialogFooter>
          <Button
            variant="outline"
            onClick={handleCancel}
            data-testid="button-cancel-keywords"
          >
            취소
          </Button>
          <Button
            onClick={handleSave}
            disabled={!isDirty || saveKeywordsMutation.isPending}
            data-testid="button-save-keywords"
          >
            {saveKeywordsMutation.isPending ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                저장 중...
              </>
            ) : (
              "저장"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

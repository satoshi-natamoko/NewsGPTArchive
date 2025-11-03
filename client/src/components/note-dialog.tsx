import { useState, useEffect } from "react";
import { ArticleWithMetadata, Note } from "@shared/schema";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useMutation, useQuery } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Trash2 } from "lucide-react";

interface NoteDialogProps {
  article: ArticleWithMetadata | null;
  isOpen: boolean;
  onClose: () => void;
}

export function NoteDialog({ article, isOpen, onClose }: NoteDialogProps) {
  const [noteContent, setNoteContent] = useState("");

  // Fetch note data when dialog opens
  const { data: note } = useQuery<Note | null>({
    queryKey: ["/api/notes", article?.id],
    queryFn: async () => {
      if (!article) return null;
      const response = await fetch(`/api/notes/${article.id}`, {
        credentials: "include",
      });
      if (!response.ok) {
        if (response.status === 404) return null;
        throw new Error("Failed to fetch note");
      }
      return response.json();
    },
    enabled: isOpen && !!article,
  });

  useEffect(() => {
    if (note) {
      setNoteContent(note.content);
    } else {
      setNoteContent("");
    }
  }, [note]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!article) return;
      const response = await apiRequest("POST", `/api/notes/${article.id}`, { content: noteContent });
      return response.json();
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["/api/articles"] });
      await queryClient.invalidateQueries({ queryKey: ["/api/notes", article?.id] });
      onClose();
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async () => {
      if (!article) return;
      const response = await apiRequest("DELETE", `/api/notes/${article.id}`);
      return response.json();
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["/api/articles"] });
      await queryClient.invalidateQueries({ queryKey: ["/api/notes", article?.id] });
      setNoteContent("");
      onClose();
    },
  });

  if (!article) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md" data-testid="dialog-note">
        <DialogHeader>
          <DialogTitle className="text-base">메모</DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4">
          {/* Article title */}
          <p className="text-sm text-muted-foreground line-clamp-2">
            {article.title}
          </p>

          {/* Note textarea */}
          <Textarea
            value={noteContent}
            onChange={(e) => setNoteContent(e.target.value)}
            placeholder="메모를 입력하세요..."
            rows={6}
            className="resize-none"
            data-testid="input-note-content"
          />
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          {note && (
            <Button
              variant="ghost"
              onClick={() => deleteMutation.mutate()}
              disabled={deleteMutation.isPending}
              data-testid="button-delete-note"
            >
              <Trash2 className="h-4 w-4 mr-2" />
              삭제
            </Button>
          )}
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={onClose}
              data-testid="button-cancel-note"
            >
              취소
            </Button>
            <Button
              onClick={() => saveMutation.mutate()}
              disabled={saveMutation.isPending || !noteContent.trim()}
              data-testid="button-save-note"
            >
              저장
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

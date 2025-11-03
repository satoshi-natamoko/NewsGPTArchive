import { useEffect, useState, useRef, useCallback } from "react";

export interface CrawlProgressMessage {
  type: string;
  categoryId?: string;
  categoryName?: string;
  keyword?: string;
  keywordIndex?: number;
  totalKeywords?: number;
  keywordCount?: number;
  articleCount?: number;
  articlesCount?: number;
  failedKeywords?: number;
  totalSuccess?: boolean;
  articleTitle?: string;
  success?: boolean;
  reason?: string;
  error?: string;
  totalCategories?: number;
  totalArticles?: number;
  duration?: number;
  timestamp?: string;
  categories?: Array<{ id: string; name: string }>;
}

export interface CategoryProgress {
  id: string;
  name: string;
  status: "pending" | "processing" | "completed" | "error" | "skipped";
  message?: string;
  articleTitle?: string;
  keywordsCompleted?: number;
  totalKeywords?: number;
}

export function useCrawlProgress() {
  const [isConnected, setIsConnected] = useState(false);
  const [messages, setMessages] = useState<CrawlProgressMessage[]>([]);
  const [categoryProgress, setCategoryProgress] = useState<Map<string, CategoryProgress>>(new Map());
  const [isComplete, setIsComplete] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);

  const connect = useCallback(() => {
    // If already connected, don't reconnect
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      console.log("WebSocket already connected, reusing existing connection");
      return;
    }

    // Only clear state if this is a completely new crawl (not resuming)
    if (!wsRef.current || wsRef.current.readyState === WebSocket.CLOSED) {
      setMessages([]);
      setCategoryProgress(new Map());
      setIsComplete(false);
    }

    // Create WebSocket connection
    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const ws = new WebSocket(`${protocol}//${window.location.host}/ws/crawl`);

    ws.onopen = () => {
      console.log("WebSocket connected");
      setIsConnected(true);
    };

    ws.onmessage = (event) => {
      try {
        const message: CrawlProgressMessage = JSON.parse(event.data);
        console.log("Crawl progress:", message);

        // Add message to list
        setMessages((prev) => [...prev, message]);

        // Initialize categories when crawl starts
        if (message.type === "crawl_started" && message.categories) {
          const initialMap = new Map<string, CategoryProgress>();
          message.categories.forEach(cat => {
            initialMap.set(cat.id, {
              id: cat.id,
              name: cat.name,
              status: "pending",
              message: "대기 중...",
            });
          });
          setCategoryProgress(initialMap);
        }
        // Update category progress
        else if (message.type === "category_started") {
          setCategoryProgress((prev) => {
            const newMap = new Map(prev);
            newMap.set(message.categoryId!, {
              id: message.categoryId!,
              name: message.categoryName!,
              status: "processing",
              message: `키워드 ${message.keywordCount}개 검색 중...`,
              keywordsCompleted: 0,
              totalKeywords: message.keywordCount,
            });
            return newMap;
          });
        } 
        // Keyword-level progress tracking
        else if (message.type === "keyword_started") {
          setCategoryProgress((prev) => {
            const newMap = new Map(prev);
            const existing = newMap.get(message.categoryId!);
            if (existing) {
              newMap.set(message.categoryId!, {
                ...existing,
                message: `[${message.keywordIndex}/${message.totalKeywords}] ${message.keyword} 검색 중...`,
              });
            }
            return newMap;
          });
        } else if (message.type === "keyword_articles_found") {
          setCategoryProgress((prev) => {
            const newMap = new Map(prev);
            const existing = newMap.get(message.categoryId!);
            if (existing) {
              newMap.set(message.categoryId!, {
                ...existing,
                message: `${message.keyword}: 기사 ${message.articleCount}개 발견`,
              });
            }
            return newMap;
          });
        } else if (message.type === "keyword_article_selected") {
          setCategoryProgress((prev) => {
            const newMap = new Map(prev);
            const existing = newMap.get(message.categoryId!);
            if (existing) {
              newMap.set(message.categoryId!, {
                ...existing,
                message: `${message.keyword}: 대표 기사 선정 완료`,
              });
            }
            return newMap;
          });
        } else if (message.type === "keyword_summarizing") {
          setCategoryProgress((prev) => {
            const newMap = new Map(prev);
            const existing = newMap.get(message.categoryId!);
            if (existing) {
              newMap.set(message.categoryId!, {
                ...existing,
                message: `${message.keyword}: GPT-5-NANO로 요약 중...`,
              });
            }
            return newMap;
          });
        } else if (message.type === "keyword_completed") {
          setCategoryProgress((prev) => {
            const newMap = new Map(prev);
            const existing = newMap.get(message.categoryId!);
            if (existing) {
              // Only count successful keywords
              const completed = message.success 
                ? (existing.keywordsCompleted || 0) + 1 
                : (existing.keywordsCompleted || 0);
              
              let displayMessage: string;
              if (message.success) {
                displayMessage = `${completed}/${existing.totalKeywords} 키워드 완료`;
              } else {
                // Show failure reason
                displayMessage = `${message.keyword}: ${message.reason || "뉴스 없음"}`;
              }

              newMap.set(message.categoryId!, {
                ...existing,
                message: displayMessage,
                keywordsCompleted: completed,
              });
            }
            return newMap;
          });
        } else if (message.type === "keyword_error") {
          setCategoryProgress((prev) => {
            const newMap = new Map(prev);
            const existing = newMap.get(message.categoryId!);
            if (existing) {
              // Don't count errors as completed
              newMap.set(message.categoryId!, {
                ...existing,
                message: `${message.keyword}: ${message.error || "오류"}`,
              });
            }
            return newMap;
          });
        } else if (message.type === "category_articles_found") {
          setCategoryProgress((prev) => {
            const newMap = new Map(prev);
            const existing = newMap.get(message.categoryId!);
            if (existing) {
              newMap.set(message.categoryId!, {
                ...existing,
                message: `기사 ${message.articleCount}개 발견`,
              });
            }
            return newMap;
          });
        } else if (message.type === "category_article_selected") {
          setCategoryProgress((prev) => {
            const newMap = new Map(prev);
            const existing = newMap.get(message.categoryId!);
            if (existing) {
              newMap.set(message.categoryId!, {
                ...existing,
                message: "대표 기사 선정 완료",
                articleTitle: message.articleTitle,
              });
            }
            return newMap;
          });
        } else if (message.type === "category_summarizing") {
          setCategoryProgress((prev) => {
            const newMap = new Map(prev);
            const existing = newMap.get(message.categoryId!);
            if (existing) {
              newMap.set(message.categoryId!, {
                ...existing,
                message: "GPT-5-NANO로 요약 중...",
              });
            }
            return newMap;
          });
        } else if (message.type === "category_completed") {
          setCategoryProgress((prev) => {
            const newMap = new Map(prev);
            const existing = newMap.get(message.categoryId!);
            if (existing) {
              const articlesCount = message.articlesCount || 0;
              const totalKeywords = message.totalKeywords || existing.totalKeywords || 0;
              const failedKeywords = message.failedKeywords || 0;
              const totalSuccess = message.totalSuccess || false;
              
              // Determine status: completed if all success, error if none, processing if partial
              let status: "completed" | "error" | "processing";
              if (!message.success) {
                status = "error";
              } else if (totalSuccess) {
                status = "completed";
              } else {
                status = "completed"; // Partial success still shows as completed
              }

              newMap.set(message.categoryId!, {
                ...existing,
                status,
                message: message.reason || (message.success 
                  ? "완료" 
                  : "뉴스 없음"),
                keywordsCompleted: articlesCount, // Use actual article count instead of total keywords
              });
            }
            return newMap;
          });
        } else if (message.type === "category_skipped") {
          setCategoryProgress((prev) => {
            const newMap = new Map(prev);
            newMap.set(message.categoryId!, {
              id: message.categoryId!,
              name: message.categoryName!,
              status: "skipped",
              message: message.reason || "건너뜀",
            });
            return newMap;
          });
        } else if (message.type === "category_error") {
          setCategoryProgress((prev) => {
            const newMap = new Map(prev);
            const existing = newMap.get(message.categoryId!);
            if (existing) {
              newMap.set(message.categoryId!, {
                ...existing,
                status: "error",
                message: message.error || "오류 발생",
              });
            }
            return newMap;
          });
        } else if (message.type === "crawl_completed") {
          setIsComplete(true);
        }
      } catch (error) {
        console.error("Failed to parse WebSocket message:", error);
      }
    };

    ws.onerror = (error) => {
      console.error("WebSocket error:", error);
    };

    ws.onclose = () => {
      console.log("WebSocket disconnected");
      setIsConnected(false);
    };

    wsRef.current = ws;
  }, []);

  const disconnect = useCallback(() => {
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
  }, []);

  useEffect(() => {
    return () => {
      disconnect();
    };
  }, [disconnect]);

  return {
    isConnected,
    messages,
    categoryProgress,
    isComplete,
    connect,
    disconnect,
  };
}

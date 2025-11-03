import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { Calendar, Menu, Search, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DatePicker } from "@/components/ui/date-picker";
import { ManagementPanel } from "@/components/management-panel";
import { ArticleList } from "@/components/article-list";
import { SearchBar, type SearchFilters } from "@/components/search-bar";
import { TimelineView } from "@/components/timeline-view";
import { CategoryWithArticles, ArticleWithMetadata, CategoryWithKeywords } from "@shared/schema";

export default function HomePage() {
  const today = new Date();
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(today);
  const [isManagementOpen, setIsManagementOpen] = useState(false);
  const [deleteMode, setDeleteMode] = useState(false);
  const [searchMode, setSearchMode] = useState(false);
  const [searchFilters, setSearchFilters] = useState<SearchFilters | null>(null);

  // Fetch categories
  const { data: categories = [] } = useQuery<CategoryWithKeywords[]>({
    queryKey: ["/api/categories"],
  });

  // Fetch available dates (for DateRangePicker highlighting)
  const { data: availableDates = [] } = useQuery<string[]>({
    queryKey: ["/api/articles/dates"],
  });

  // Fetch articles for selected date
  const { data: categoriesWithArticles = [], isLoading } = useQuery<
    CategoryWithArticles[]
  >({
    queryKey: ["/api/articles", selectedDate],
    queryFn: async () => {
      if (!selectedDate) {
        return [];
      }
      
      const dateStr = format(selectedDate, "yyyy-MM-dd");
      
      const response = await fetch(`/api/articles?date=${dateStr}`);
      if (!response.ok) {
        throw new Error("Failed to fetch articles");
      }
      return response.json();
    },
    enabled: !searchMode && !!selectedDate,
  });

  // Fetch archive search results
  const { data: searchResults = [], isLoading: isSearching } = useQuery<
    ArticleWithMetadata[]
  >({
    queryKey: ["/api/articles/search", searchFilters],
    queryFn: async () => {
      if (!searchFilters || searchFilters.searchType !== "archive") return [];
      
      const params = new URLSearchParams();
      if (searchFilters.query) params.append("q", searchFilters.query);
      if (searchFilters.categoryId) params.append("categoryId", searchFilters.categoryId);
      if (searchFilters.dateRange?.from) {
        params.append("startDate", format(searchFilters.dateRange.from, "yyyy-MM-dd"));
      }
      if (searchFilters.dateRange?.to) {
        params.append("endDate", format(searchFilters.dateRange.to, "yyyy-MM-dd"));
      }

      const response = await fetch(`/api/articles/search?${params.toString()}`);
      if (!response.ok) {
        throw new Error("Failed to search articles");
      }
      return response.json();
    },
    enabled: searchMode && searchFilters !== null && searchFilters.searchType === "archive",
  });

  // Fetch live search results
  const { data: liveResults = [], isLoading: isSearchingLive } = useQuery<any[]>({
    queryKey: ["/api/search/live", searchFilters?.query, searchFilters?.daysBack],
    queryFn: async () => {
      if (!searchFilters || !searchFilters.query || searchFilters.searchType !== "live") return [];
      
      const params = new URLSearchParams();
      params.append("q", searchFilters.query);
      if (searchFilters.daysBack) {
        params.append("daysBack", searchFilters.daysBack.toString());
      }

      const response = await fetch(`/api/search/live?${params.toString()}`);
      if (!response.ok) {
        throw new Error("Failed to search live news");
      }
      return response.json();
    },
    enabled: searchMode && searchFilters !== null && searchFilters.searchType === "live" && !!searchFilters.query,
  });

  // Convert live results to ArticleWithMetadata format for TimelineView
  const liveResultsAsArticles: ArticleWithMetadata[] = liveResults.map((item: any, index: number) => ({
    id: `live-${index}-${Date.now()}`,
    title: item.title,
    summary: item.summary || item.description,
    url: item.link,
    publishedDate: new Date(item.pubDate),
    crawledDate: new Date(),
    categoryId: undefined as any,
    categoryName: undefined as any,
    keyword: null,
    isBookmarked: false,
    note: null,
  }));

  const handleSearch = (filters: SearchFilters) => {
    setSearchFilters(filters);
    setSearchMode(true);
  };

  const handleToggleMode = () => {
    setSearchMode(!searchMode);
    if (searchMode) {
      setSearchFilters(null);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-50 w-full border-b border-border bg-background/95 backdrop-blur-md shadow-sm">
        <div className="container mx-auto flex h-20 items-center justify-between px-8 md:px-16 lg:px-24">
          {/* Logo */}
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-semibold tracking-tight" data-testid="text-title">
              뉴스 아카이브
            </h1>
            <Button
              variant={searchMode ? "default" : "outline"}
              size="sm"
              onClick={handleToggleMode}
              data-testid="button-toggle-search-mode"
            >
              {searchMode ? (
                <>
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  뒤로 가기
                </>
              ) : (
                <>
                  <Search className="h-4 w-4 mr-2" />
                  기타 검색
                </>
              )}
            </Button>
          </div>

          {/* Date Selector - Only show in date mode */}
          {!searchMode && (
            <DatePicker
              date={selectedDate}
              onDateChange={setSelectedDate}
              availableDates={availableDates}
              data-testid="date-picker-main"
            />
          )}

          {searchMode && <div />}

          {/* Actions */}
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              onClick={() => setIsManagementOpen(true)}
              data-testid="button-open-management"
            >
              <Menu className="h-4 w-4 mr-2" />
              메뉴
            </Button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-8 py-12 md:px-16 md:py-16 lg:px-24">
        {searchMode ? (
          <div className="space-y-8">
            <SearchBar
              categories={categories}
              onSearch={handleSearch}
            />
            
            {(isSearching || isSearchingLive) ? (
              <div className="text-center py-12 text-muted-foreground">
                검색 중...
              </div>
            ) : (
              <TimelineView
                articles={searchFilters?.searchType === "live" ? liveResultsAsArticles : searchResults}
                categories={categories}
              />
            )}
          </div>
        ) : (
          <ArticleList
            categories={categoriesWithArticles}
            isLoading={isLoading}
            deleteMode={deleteMode}
            selectedDate={selectedDate}
            availableDates={availableDates}
          />
        )}
      </main>

      {/* Management Panel */}
      <ManagementPanel
        isOpen={isManagementOpen}
        onClose={() => setIsManagementOpen(false)}
        deleteMode={deleteMode}
        setDeleteMode={setDeleteMode}
        selectedDate={selectedDate}
      />
    </div>
  );
}

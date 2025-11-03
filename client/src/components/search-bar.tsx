import { useState } from "react";
import { Search, X, Database, Radio } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { DateRangePicker } from "@/components/ui/date-range-picker";
import { DateRange } from "react-day-picker";
import type { CategoryWithKeywords } from "@shared/schema";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { useQuery } from "@tanstack/react-query";

interface SearchBarProps {
  categories: CategoryWithKeywords[];
  onSearch: (filters: SearchFilters) => void;
}

export type SearchType = "archive" | "live";

export interface SearchFilters {
  query: string;
  categoryId?: string;
  dateRange?: DateRange;
  searchType: SearchType;
  daysBack?: number;
}

export function SearchBar({ categories, onSearch }: SearchBarProps) {
  const [query, setQuery] = useState("");
  const [categoryId, setCategoryId] = useState<string | undefined>(undefined);
  const [dateRange, setDateRange] = useState<DateRange | undefined>(undefined);
  const [searchType, setSearchType] = useState<SearchType>("live");
  const [daysBack, setDaysBack] = useState<number>(7);

  const { data: availableDates = [] } = useQuery<string[]>({
    queryKey: ["/api/articles/dates"],
  });

  const handleSearch = () => {
    onSearch({
      query: query.trim(),
      categoryId,
      dateRange: searchType === "archive" ? dateRange : undefined,
      searchType,
      daysBack: searchType === "live" ? daysBack : undefined,
    });
  };

  const handleClear = () => {
    setQuery("");
    setCategoryId(undefined);
    setDateRange(undefined);
    onSearch({
      query: "",
      categoryId: undefined,
      dateRange: undefined,
      searchType,
      daysBack: searchType === "live" ? daysBack : undefined,
    });
  };

  const hasActiveFilters = query.trim() || categoryId || dateRange;

  return (
    <div className="space-y-4 p-6 bg-card border rounded-md">
      <div className="flex items-center gap-4 pb-4 border-b">
        <span className="text-sm text-muted-foreground">검색 타입:</span>
        <ToggleGroup
          type="single"
          value={searchType}
          onValueChange={(value) => {
            if (value) setSearchType(value as SearchType);
          }}
          data-testid="toggle-search-type"
        >
          <ToggleGroupItem 
            value="live" 
            data-testid="toggle-live-search"
            className="border data-[state=on]:bg-primary data-[state=on]:text-primary-foreground data-[state=off]:bg-background data-[state=off]:border-input"
          >
            <Radio className="h-4 w-4 mr-2" />
            실시간 검색
          </ToggleGroupItem>
          <ToggleGroupItem 
            value="archive" 
            data-testid="toggle-archive-search"
            className="border data-[state=on]:bg-primary data-[state=on]:text-primary-foreground data-[state=off]:bg-background data-[state=off]:border-input"
          >
            <Database className="h-4 w-4 mr-2" />
            아카이브 검색
          </ToggleGroupItem>
        </ToggleGroup>
        {searchType === "live" && (
          <Select
            value={daysBack.toString()}
            onValueChange={(value) => setDaysBack(parseInt(value))}
          >
            <SelectTrigger className="w-[140px]" data-testid="select-days-back">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="1">오늘</SelectItem>
              <SelectItem value="3">최근 3일</SelectItem>
              <SelectItem value="7">최근 1주일</SelectItem>
              <SelectItem value="30">최근 1달</SelectItem>
            </SelectContent>
          </Select>
        )}
      </div>

      <div className="flex gap-3">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder={
              searchType === "archive"
                ? "고객사명, 키워드 검색 (예: 삼성전자, 계약, 투자)"
                : "실시간 뉴스 검색 (예: 삼성전자, KeP)"
            }
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                handleSearch();
              }
            }}
            className="pl-10"
            data-testid="input-search-query"
          />
        </div>
        <Button
          onClick={handleSearch}
          data-testid="button-search"
        >
          <Search className="h-4 w-4 mr-2" />
          검색
        </Button>
        {hasActiveFilters && (
          <Button
            variant="outline"
            onClick={handleClear}
            data-testid="button-clear-search"
          >
            <X className="h-4 w-4 mr-2" />
            초기화
          </Button>
        )}
      </div>

      {searchType === "archive" && (
        <div className="space-y-3">
          <div className="flex items-center gap-3">
            <span className="text-sm font-medium text-foreground min-w-[60px]">
              1. 날짜
            </span>
            <div className="flex-1">
              <DateRangePicker
                date={dateRange}
                onDateChange={setDateRange}
                availableDates={availableDates}
                data-testid="date-range-picker-search"
              />
            </div>
          </div>

          <div className="flex items-center gap-3">
            <span className="text-sm font-medium text-foreground min-w-[60px]">
              2. 카테고리
            </span>
            <div className="flex-1">
              <Select
                value={categoryId}
                onValueChange={(value) => setCategoryId(value === "all" ? undefined : value)}
              >
                <SelectTrigger data-testid="select-category-filter">
                  <SelectValue placeholder="전체 카테고리" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">전체 카테고리</SelectItem>
                  {categories.map((category) => (
                    <SelectItem key={category.id} value={category.id}>
                      {category.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

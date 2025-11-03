import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { DateRangePicker } from "@/components/ui/date-range-picker";
import { BarChart, Bar, LineChart, Line, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import { Calendar, TrendingUp, BarChart3, ArrowLeft } from "lucide-react";
import type { CategoryStats, DateStats, CategoryDateStats } from "@shared/schema";
import { DateRange } from "react-day-picker";
import { format } from "date-fns";

const COLORS = ["#8884d8", "#82ca9d", "#ffc658", "#ff8042", "#a4de6c"];

export default function StatsPage() {
  const [dateRange, setDateRange] = useState<DateRange | undefined>();
  const [appliedDateRange, setAppliedDateRange] = useState<{ start?: string; end?: string }>({});

  const categoryStatsQuery = useQuery<CategoryStats[]>({
    queryKey: [
      "/api/stats/category",
      appliedDateRange.start || "all",
      appliedDateRange.end || "all",
    ],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (appliedDateRange.start) params.append("startDate", appliedDateRange.start);
      if (appliedDateRange.end) params.append("endDate", appliedDateRange.end);
      const queryString = params.toString();
      const url = `/api/stats/category${queryString ? `?${queryString}` : ""}`;
      const res = await fetch(url, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch stats");
      return res.json();
    },
  });

  const dateStatsQuery = useQuery<DateStats[]>({
    queryKey: [
      "/api/stats/date",
      appliedDateRange.start || "all",
      appliedDateRange.end || "all",
    ],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (appliedDateRange.start) params.append("startDate", appliedDateRange.start);
      if (appliedDateRange.end) params.append("endDate", appliedDateRange.end);
      const queryString = params.toString();
      const url = `/api/stats/date${queryString ? `?${queryString}` : ""}`;
      const res = await fetch(url, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch stats");
      return res.json();
    },
  });

  const categoryDateStatsQuery = useQuery<CategoryDateStats[]>({
    queryKey: [
      "/api/stats/category-date",
      appliedDateRange.start || "all",
      appliedDateRange.end || "all",
    ],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (appliedDateRange.start) params.append("startDate", appliedDateRange.start);
      if (appliedDateRange.end) params.append("endDate", appliedDateRange.end);
      const queryString = params.toString();
      const url = `/api/stats/category-date${queryString ? `?${queryString}` : ""}`;
      const res = await fetch(url, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch stats");
      return res.json();
    },
  });

  const handleApplyFilter = () => {
    if (dateRange?.from && dateRange?.to) {
      setAppliedDateRange({
        start: format(dateRange.from, "yyyy-MM-dd"),
        end: format(dateRange.to, "yyyy-MM-dd"),
      });
    }
  };

  const handleClearFilter = () => {
    setDateRange(undefined);
    setAppliedDateRange({});
  };

  const totalArticles = categoryStatsQuery.data?.reduce((sum, cat) => sum + cat.count, 0) || 0;

  return (
    <div className="min-h-screen bg-background p-8">
      <div className="max-w-7xl mx-auto space-y-8">
        {/* Header */}
        <div className="flex items-center gap-4 mb-4">
          <Link href="/">
            <Button variant="outline" size="icon" data-testid="button-back-home">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div>
            <h1 className="text-3xl font-bold mb-2" data-testid="text-stats-title">
              통계 대시보드
            </h1>
            <p className="text-muted-foreground">
              뉴스 아카이브 데이터를 시각화하여 분석합니다
            </p>
          </div>
        </div>

        {/* Date Range Filter */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              날짜 범위 필터
            </CardTitle>
            <CardDescription>
              통계를 조회할 날짜 범위를 설정하세요
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap items-end gap-4">
              <div className="flex-1 min-w-[300px]">
                <Label>날짜 범위</Label>
                <DateRangePicker
                  date={dateRange}
                  onDateChange={setDateRange}
                />
              </div>
              <Button onClick={handleApplyFilter} data-testid="button-apply-filter">
                필터 적용
              </Button>
              <Button variant="outline" onClick={handleClearFilter} data-testid="button-clear-filter">
                초기화
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">전체 기사 수</CardTitle>
              <BarChart3 className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold" data-testid="text-total-articles">
                {totalArticles.toLocaleString()}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                선택한 기간 동안 크롤링된 기사
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">카테고리 수</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold" data-testid="text-total-categories">
                {categoryStatsQuery.data?.length || 0}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                활성 카테고리 개수
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">일별 평균</CardTitle>
              <Calendar className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold" data-testid="text-avg-daily">
                {dateStatsQuery.data && dateStatsQuery.data.length > 0
                  ? Math.round(totalArticles / dateStatsQuery.data.length)
                  : 0}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                하루 평균 기사 수
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Charts */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Category Bar Chart */}
          <Card>
            <CardHeader>
              <CardTitle>카테고리별 기사 수</CardTitle>
              <CardDescription>각 카테고리의 기사 개수 비교</CardDescription>
            </CardHeader>
            <CardContent>
              {categoryStatsQuery.isLoading ? (
                <div className="h-80 flex items-center justify-center text-muted-foreground">
                  로딩 중...
                </div>
              ) : (
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={categoryStatsQuery.data}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="categoryName" angle={-45} textAnchor="end" height={100} />
                    <YAxis />
                    <Tooltip />
                    <Bar dataKey="count" fill="#8884d8" />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>

          {/* Category Pie Chart */}
          <Card>
            <CardHeader>
              <CardTitle>카테고리 분포</CardTitle>
              <CardDescription>전체 대비 카테고리 비율</CardDescription>
            </CardHeader>
            <CardContent>
              {categoryStatsQuery.isLoading ? (
                <div className="h-80 flex items-center justify-center text-muted-foreground">
                  로딩 중...
                </div>
              ) : (
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={categoryStatsQuery.data}
                      dataKey="count"
                      nameKey="categoryName"
                      cx="50%"
                      cy="50%"
                      outerRadius={100}
                      label
                    >
                      {categoryStatsQuery.data?.map((_, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>

          {/* Date Line Chart */}
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle>날짜별 기사 추이</CardTitle>
              <CardDescription>시간에 따른 기사 수 변화</CardDescription>
            </CardHeader>
            <CardContent>
              {dateStatsQuery.isLoading ? (
                <div className="h-80 flex items-center justify-center text-muted-foreground">
                  로딩 중...
                </div>
              ) : (
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={dateStatsQuery.data}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="date" />
                    <YAxis />
                    <Tooltip />
                    <Legend />
                    <Line type="monotone" dataKey="count" stroke="#8884d8" name="기사 수" />
                  </LineChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>

          {/* Category-Date Line Chart */}
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle>카테고리별 날짜 추이</CardTitle>
              <CardDescription>카테고리별 시간에 따른 기사 수 변화</CardDescription>
            </CardHeader>
            <CardContent>
              {categoryDateStatsQuery.isLoading ? (
                <div className="h-80 flex items-center justify-center text-muted-foreground">
                  로딩 중...
                </div>
              ) : categoryDateStatsQuery.data && categoryDateStatsQuery.data.length > 0 ? (
                <ResponsiveContainer width="100%" height={400}>
                  <LineChart
                    data={
                      categoryDateStatsQuery.data[0]?.stats.map((stat) => {
                        const dataPoint: any = { date: stat.date };
                        categoryDateStatsQuery.data?.forEach((catStat) => {
                          const found = catStat.stats.find((s) => s.date === stat.date);
                          dataPoint[catStat.categoryName] = found?.count || 0;
                        });
                        return dataPoint;
                      }) || []
                    }
                  >
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="date" />
                    <YAxis />
                    <Tooltip />
                    <Legend />
                    {categoryDateStatsQuery.data?.map((catStat, index) => (
                      <Line
                        key={catStat.categoryId}
                        type="monotone"
                        dataKey={catStat.categoryName}
                        stroke={COLORS[index % COLORS.length]}
                      />
                    ))}
                  </LineChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-80 flex items-center justify-center text-muted-foreground">
                  데이터가 없습니다
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

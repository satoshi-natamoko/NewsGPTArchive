import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { crawlNews, searchLiveNews, fetchArticlesForKeyword } from "./crawler";
import { summarizeArticle } from "./openai";
import { z } from "zod";
import { getSchedulerSettings, updateSchedulerSettings } from "./scheduler";
import { getNotificationSettings, updateNotificationSettings } from "./notifier";
import * as cron from "node-cron";

export async function registerRoutes(app: Express): Promise<Server> {
  // GET /api/health - Health check endpoint for Render
  app.get("/api/health", (req, res) => {
    res.status(200).json({ status: "ok", timestamp: new Date().toISOString() });
  });

  // GET /api/categories - Get all categories with keywords
  app.get("/api/categories", async (req, res) => {
    try {
      const categories = await storage.getCategoriesWithKeywords();
      res.json(categories);
    } catch (error: any) {
      console.error("Error fetching categories:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // PUT /api/keywords - Update keywords for all categories
  app.put("/api/keywords", async (req, res) => {
    try {
      const schema = z.object({
        keywords: z.record(z.array(z.string())),
      });

      const { keywords } = schema.parse(req.body);

      // Update keywords for each category
      for (const [categoryId, keywordList] of Object.entries(keywords)) {
        await storage.updateKeywordsByCategory(categoryId, keywordList);
      }

      res.json({ success: true });
    } catch (error: any) {
      console.error("Error updating keywords:", error);
      res.status(400).json({ error: error.message });
    }
  });

  // GET /api/articles/dates - Get all available dates with articles
  app.get("/api/articles/dates", async (req, res) => {
    try {
      const dates = await storage.getAvailableDates();
      res.json(dates);
    } catch (error: any) {
      console.error("Error fetching dates:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // GET /api/articles?date=YYYY-MM-DD or ?startDate=YYYY-MM-DD&endDate=YYYY-MM-DD
  app.get("/api/articles", async (req, res) => {
    try {
      const date = req.query.date as string | undefined;
      const startDate = req.query.startDate as string | undefined;
      const endDate = req.query.endDate as string | undefined;
      
      // Support both single date and date range
      if (startDate && endDate) {
        const categoriesWithArticles = await storage.getCategoriesWithArticlesByDateRange(startDate, endDate);
        res.json(categoriesWithArticles);
      } else if (date) {
        const categoriesWithArticles = await storage.getCategoriesWithArticlesByDate(date);
        res.json(categoriesWithArticles);
      } else {
        return res.status(400).json({ error: "Either date or startDate+endDate parameters are required" });
      }
    } catch (error: any) {
      console.error("Error fetching articles:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // GET /api/articles/search - Search articles with filters
  app.get("/api/articles/search", async (req, res) => {
    try {
      const query = req.query.q as string | undefined;
      const startDate = req.query.startDate as string | undefined;
      const endDate = req.query.endDate as string | undefined;
      const categoryId = req.query.categoryId as string | undefined;

      const results = await storage.searchArticles(query, startDate, endDate, categoryId);
      res.json(results);
    } catch (error: any) {
      console.error("Error searching articles:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // GET /api/search/live - Search live news from Naver API
  app.get("/api/search/live", async (req, res) => {
    try {
      const query = req.query.q as string | undefined;
      const daysBackParam = req.query.daysBack || req.query.days;
      const daysBack = daysBackParam ? parseInt(daysBackParam as string) : 7;

      if (!query || !query.trim()) {
        return res.status(400).json({ error: "검색어가 필요합니다." });
      }

      const results = await searchLiveNews(query.trim(), daysBack);
      res.json(results);
    } catch (error: any) {
      console.error("Error searching live news:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // POST /api/crawl - Start crawling news
  app.post("/api/crawl", async (req, res) => {
    try {
      const schema = z.object({
        deleteExisting: z.boolean().optional(),
      });

      const { deleteExisting } = schema.parse(req.body);

      // If deleteExisting is true, delete today's articles first
      if (deleteExisting) {
        const today = new Date().toISOString().split("T")[0];
        await storage.deleteArticlesByDate(today);
        console.log(`Deleted existing articles for ${today}`);
      }

      // Start crawling (this might take a while)
      // In a production app, you'd want to run this in a background job
      await crawlNews();

      res.json({ success: true, message: "Crawling completed successfully" });
    } catch (error: any) {
      console.error("Error during crawling:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // DELETE /api/articles/date/:date - Delete all articles for a specific date
  app.delete("/api/articles/date/:date", async (req, res) => {
    try {
      const date = req.params.date;
      
      if (!date) {
        return res.status(400).json({ error: "Date parameter is required" });
      }

      await storage.deleteArticlesByDate(date);
      res.json({ success: true, message: `Articles for ${date} deleted successfully` });
    } catch (error: any) {
      console.error("Error deleting articles by date:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // DELETE /api/articles/bulk - Delete multiple articles by IDs
  app.delete("/api/articles/bulk", async (req, res) => {
    try {
      const schema = z.object({
        articleIds: z.array(z.string()),
      });

      const { articleIds } = schema.parse(req.body);

      if (articleIds.length === 0) {
        return res.status(400).json({ error: "No article IDs provided" });
      }

      await storage.deleteArticlesByIds(articleIds);
      res.json({ success: true, message: `${articleIds.length} articles deleted successfully` });
    } catch (error: any) {
      console.error("Error deleting articles:", error);
      res.status(400).json({ error: error.message });
    }
  });

  // GET /api/articles/:articleId/alternatives - Get alternative articles for replacement
  app.get("/api/articles/:articleId/alternatives", async (req, res) => {
    try {
      const articleId = req.params.articleId;
      
      // Get the article to find its keyword
      const article = await storage.getArticleById(articleId);
      if (!article) {
        return res.status(404).json({ error: "Article not found" });
      }

      if (!article.keyword) {
        return res.status(400).json({ error: "This article has no associated keyword for finding alternatives" });
      }

      // Fetch alternative articles using the same keyword
      const alternatives = await fetchArticlesForKeyword(article.keyword);
      res.json({ keyword: article.keyword, articles: alternatives });
    } catch (error: any) {
      console.error("Error fetching alternative articles:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // PUT /api/articles/:articleId/replace - Replace an article with selected alternative
  app.put("/api/articles/:articleId/replace", async (req, res) => {
    try {
      const articleId = req.params.articleId;
      const schema = z.object({
        title: z.string(),
        description: z.string(),
        url: z.string(),
        publishedDate: z.string(),
      });

      const { title, description, url, publishedDate } = schema.parse(req.body);

      // Generate summary using GPT, with fallback to description
      let summary: string;
      try {
        summary = await summarizeArticle(title + " " + description);
      } catch (error) {
        console.warn("GPT summarization failed, using description as fallback:", error);
        // Use first 200 characters of description as fallback
        summary = description.length > 200 
          ? description.substring(0, 200) + "..." 
          : description;
      }

      // Update the article
      const updatedArticle = await storage.updateArticle(articleId, {
        title,
        summary,
        url,
        publishedDate: new Date(publishedDate),
      });

      res.json(updatedArticle);
    } catch (error: any) {
      console.error("Error replacing article:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // POST /api/bookmarks/:articleId - Toggle bookmark for an article
  app.post("/api/bookmarks/:articleId", async (req, res) => {
    try {
      const articleId = req.params.articleId;
      const isBookmarked = await storage.toggleBookmark(articleId);
      res.json({ isBookmarked });
    } catch (error: any) {
      console.error("Error toggling bookmark:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // GET /api/bookmarks - Get all bookmarked articles
  app.get("/api/bookmarks", async (req, res) => {
    try {
      const bookmarkedArticles = await storage.getBookmarkedArticles();
      res.json(bookmarkedArticles);
    } catch (error: any) {
      console.error("Error fetching bookmarks:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // GET /api/notes/:articleId - Get note for an article
  app.get("/api/notes/:articleId", async (req, res) => {
    try {
      const articleId = req.params.articleId;
      const note = await storage.getNote(articleId);
      res.json(note);
    } catch (error: any) {
      console.error("Error fetching note:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // POST /api/notes/:articleId - Save or update note for an article
  app.post("/api/notes/:articleId", async (req, res) => {
    try {
      const articleId = req.params.articleId;
      const schema = z.object({
        content: z.string(),
      });

      const { content } = schema.parse(req.body);
      const note = await storage.saveNote(articleId, content);
      res.json(note);
    } catch (error: any) {
      console.error("Error saving note:", error);
      res.status(400).json({ error: error.message });
    }
  });

  // DELETE /api/notes/:articleId - Delete note for an article
  app.delete("/api/notes/:articleId", async (req, res) => {
    try {
      const articleId = req.params.articleId;
      await storage.deleteNote(articleId);
      res.json({ success: true });
    } catch (error: any) {
      console.error("Error deleting note:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // GET /api/stats/category?startDate=YYYY-MM-DD&endDate=YYYY-MM-DD - Get article count by category
  app.get("/api/stats/category", async (req, res) => {
    try {
      const startDate = req.query.startDate as string | undefined;
      const endDate = req.query.endDate as string | undefined;
      
      const stats = await storage.getCategoryStats(startDate, endDate);
      res.json(stats);
    } catch (error: any) {
      console.error("Error fetching category stats:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // GET /api/stats/date?startDate=YYYY-MM-DD&endDate=YYYY-MM-DD - Get article count by date
  app.get("/api/stats/date", async (req, res) => {
    try {
      const startDate = req.query.startDate as string | undefined;
      const endDate = req.query.endDate as string | undefined;
      
      const stats = await storage.getDateStats(startDate, endDate);
      res.json(stats);
    } catch (error: any) {
      console.error("Error fetching date stats:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // GET /api/stats/category-date?startDate=YYYY-MM-DD&endDate=YYYY-MM-DD - Get article count by category and date
  app.get("/api/stats/category-date", async (req, res) => {
    try {
      const startDate = req.query.startDate as string | undefined;
      const endDate = req.query.endDate as string | undefined;
      
      const stats = await storage.getCategoryDateStats(startDate, endDate);
      res.json(stats);
    } catch (error: any) {
      console.error("Error fetching category-date stats:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // GET /api/scheduler - Get scheduler settings
  app.get("/api/scheduler", async (req, res) => {
    try {
      const settings = await getSchedulerSettings();
      res.json(settings);
    } catch (error: any) {
      console.error("Error fetching scheduler settings:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // PUT /api/scheduler - Update scheduler settings
  app.put("/api/scheduler", async (req, res) => {
    try {
      const schema = z.object({
        enabled: z.boolean().optional(),
        cronExpression: z.string().optional(),
        deleteExisting: z.boolean().optional(),
      });

      const updates = schema.parse(req.body);
      
      // Validate cron expression if provided
      if (updates.cronExpression !== undefined && !cron.validate(updates.cronExpression)) {
        return res.status(400).json({ 
          error: `유효하지 않은 크론 표현식입니다: ${updates.cronExpression}` 
        });
      }
      
      const updatedSettings = await updateSchedulerSettings(updates);
      
      res.json(updatedSettings);
    } catch (error: any) {
      console.error("Error updating scheduler settings:", error);
      
      // Return 400 for validation errors, 500 for server errors
      if (error.name === "ZodError") {
        return res.status(400).json({ error: "잘못된 입력 데이터입니다." });
      }
      
      res.status(500).json({ error: error.message });
    }
  });

  // GET /api/notifications - Get notification settings
  app.get("/api/notifications", async (req, res) => {
    try {
      const settings = await getNotificationSettings();
      res.json(settings);
    } catch (error: any) {
      console.error("Error fetching notification settings:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // PUT /api/notifications - Update notification settings
  app.put("/api/notifications", async (req, res) => {
    try {
      const schema = z.object({
        enabled: z.boolean().optional(),
        emailEnabled: z.boolean().optional(),
        emailAddress: z.string().nullable().optional(),
        slackEnabled: z.boolean().optional(),
        slackWebhookUrl: z.string().nullable().optional(),
      });

      const updates = schema.parse(req.body);
      
      // Validate email if emailEnabled is being set to true
      if (updates.emailEnabled && !updates.emailAddress) {
        return res.status(400).json({ 
          error: "이메일 알림을 활성화하려면 이메일 주소를 입력해야 합니다." 
        });
      }
      
      // Validate Slack webhook if slackEnabled is being set to true
      if (updates.slackEnabled && !updates.slackWebhookUrl) {
        return res.status(400).json({ 
          error: "Slack 알림을 활성화하려면 Webhook URL을 입력해야 합니다." 
        });
      }
      
      const updatedSettings = await updateNotificationSettings(updates);
      
      res.json(updatedSettings);
    } catch (error: any) {
      console.error("Error updating notification settings:", error);
      
      // Return 400 for validation errors, 500 for server errors
      if (error.name === "ZodError") {
        return res.status(400).json({ error: "잘못된 입력 데이터입니다." });
      }
      
      res.status(500).json({ error: error.message });
    }
  });

  // GET /api/export?startDate=YYYY-MM-DD&endDate=YYYY-MM-DD - Export articles as CSV
  app.get("/api/export", async (req, res) => {
    try {
      const startDate = req.query.startDate as string;
      const endDate = req.query.endDate as string;

      if (!startDate || !endDate) {
        return res.status(400).json({ error: "Both startDate and endDate are required" });
      }

      const categoriesWithArticles = await storage.getArticlesForExport(startDate, endDate);

      // Generate CSV content
      const csvRows: string[] = [];
      
      // CSV header
      csvRows.push("날짜,카테고리,제목,요약,URL");

      // Add data rows
      for (const category of categoriesWithArticles) {
        for (const article of category.articles) {
          const crawledDate = new Date(article.crawledDate).toISOString().split("T")[0];
          const categoryName = `"${category.name.replace(/"/g, '""')}"`;
          const title = `"${article.title.replace(/"/g, '""')}"`;
          const summary = `"${article.summary.replace(/"/g, '""')}"`;
          const url = `"${article.url.replace(/"/g, '""')}"`;
          
          csvRows.push(`${crawledDate},${categoryName},${title},${summary},${url}`);
        }
      }

      const csvContent = csvRows.join("\n");
      
      // Set headers for CSV download
      res.setHeader("Content-Type", "text/csv; charset=utf-8");
      res.setHeader("Content-Disposition", `attachment; filename="news_export_${startDate}_${endDate}.csv"`);
      
      // Add BOM for proper Korean character encoding in Excel
      res.send("\uFEFF" + csvContent);
    } catch (error: any) {
      console.error("Error exporting articles:", error);
      res.status(500).json({ error: error.message });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}

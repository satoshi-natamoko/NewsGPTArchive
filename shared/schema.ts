import { sql } from "drizzle-orm";
import { pgTable, text, varchar, timestamp, integer, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { relations } from "drizzle-orm";

// Categories table
export const categories = pgTable("categories", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull().unique(),
  displayOrder: integer("display_order").notNull(),
});

// Keywords table - stores keywords for each category
export const keywords = pgTable("keywords", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  categoryId: varchar("category_id").notNull().references(() => categories.id, { onDelete: "cascade" }),
  keyword: text("keyword").notNull(),
});

// Articles table - stores crawled and summarized articles
export const articles = pgTable("articles", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  categoryId: varchar("category_id").notNull().references(() => categories.id, { onDelete: "cascade" }),
  keyword: text("keyword"), // Which keyword this article was crawled with (nullable for existing articles)
  title: text("title").notNull(),
  summary: text("summary").notNull(),
  url: text("url").notNull(),
  publishedDate: timestamp("published_date").notNull(),
  crawledDate: timestamp("crawled_date").notNull().defaultNow(),
});

// Bookmarks table - tracks bookmarked articles
export const bookmarks = pgTable("bookmarks", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  articleId: varchar("article_id").notNull().references(() => articles.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// Notes table - stores notes for articles
export const notes = pgTable("notes", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  articleId: varchar("article_id").notNull().references(() => articles.id, { onDelete: "cascade" }),
  content: text("content").notNull(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// Scheduler settings table - stores crawling schedule configuration
export const schedulerSettings = pgTable("scheduler_settings", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  enabled: boolean("enabled").notNull().default(false),
  cronExpression: text("cron_expression").notNull().default("0 9 * * *"), // Default: 9 AM daily
  deleteExisting: boolean("delete_existing").notNull().default(false),
  lastRun: timestamp("last_run"),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// Notification settings table - stores notification configuration
export const notificationSettings = pgTable("notification_settings", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  enabled: boolean("enabled").notNull().default(false),
  emailEnabled: boolean("email_enabled").notNull().default(false),
  emailAddress: text("email_address"),
  slackEnabled: boolean("slack_enabled").notNull().default(false),
  slackWebhookUrl: text("slack_webhook_url"),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// Relations
export const categoriesRelations = relations(categories, ({ many }) => ({
  keywords: many(keywords),
  articles: many(articles),
}));

export const keywordsRelations = relations(keywords, ({ one }) => ({
  category: one(categories, {
    fields: [keywords.categoryId],
    references: [categories.id],
  }),
}));

export const articlesRelations = relations(articles, ({ one, many }) => ({
  category: one(categories, {
    fields: [articles.categoryId],
    references: [categories.id],
  }),
  bookmark: one(bookmarks, {
    fields: [articles.id],
    references: [bookmarks.articleId],
  }),
  note: one(notes, {
    fields: [articles.id],
    references: [notes.articleId],
  }),
}));

export const bookmarksRelations = relations(bookmarks, ({ one }) => ({
  article: one(articles, {
    fields: [bookmarks.articleId],
    references: [articles.id],
  }),
}));

export const notesRelations = relations(notes, ({ one }) => ({
  article: one(articles, {
    fields: [notes.articleId],
    references: [articles.id],
  }),
}));

// Insert schemas
export const insertCategorySchema = createInsertSchema(categories).omit({
  id: true,
});

export const insertKeywordSchema = createInsertSchema(keywords).omit({
  id: true,
});

export const insertArticleSchema = createInsertSchema(articles).omit({
  id: true,
  crawledDate: true,
});

export const insertBookmarkSchema = createInsertSchema(bookmarks).omit({
  id: true,
  createdAt: true,
});

export const insertNoteSchema = createInsertSchema(notes).omit({
  id: true,
  updatedAt: true,
});

export const insertSchedulerSettingsSchema = createInsertSchema(schedulerSettings).omit({
  id: true,
  updatedAt: true,
});

export const insertNotificationSettingsSchema = createInsertSchema(notificationSettings).omit({
  id: true,
  updatedAt: true,
});

// Types
export type InsertCategory = z.infer<typeof insertCategorySchema>;
export type Category = typeof categories.$inferSelect;

export type InsertKeyword = z.infer<typeof insertKeywordSchema>;
export type Keyword = typeof keywords.$inferSelect;

export type InsertArticle = z.infer<typeof insertArticleSchema>;
export type Article = typeof articles.$inferSelect;

export type InsertBookmark = z.infer<typeof insertBookmarkSchema>;
export type Bookmark = typeof bookmarks.$inferSelect;

export type InsertNote = z.infer<typeof insertNoteSchema>;
export type Note = typeof notes.$inferSelect;

export type InsertSchedulerSettings = z.infer<typeof insertSchedulerSettingsSchema>;
export type SchedulerSettings = typeof schedulerSettings.$inferSelect;

export type InsertNotificationSettings = z.infer<typeof insertNotificationSettingsSchema>;
export type NotificationSettings = typeof notificationSettings.$inferSelect;

// Extended types for UI
export type CategoryWithKeywords = Category & {
  keywords: Keyword[];
};

export type ArticleWithMetadata = Article & {
  bookmark?: Bookmark | null;
  note?: Note | null;
  isBookmarked?: boolean;
};

export type CategoryWithArticles = Category & {
  articles: ArticleWithMetadata[];
};

export type ArticlesByDate = {
  date: string;
  categories: {
    category: Category;
    articles: ArticleWithMetadata[];
  }[];
};

// Statistics types
export type CategoryStats = {
  categoryId: string;
  categoryName: string;
  count: number;
};

export type DateStats = {
  date: string;
  count: number;
};

export type CategoryDateStats = {
  categoryId: string;
  categoryName: string;
  stats: DateStats[];
};

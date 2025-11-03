// Reference: javascript_database blueprint
import {
  categories,
  keywords,
  articles,
  bookmarks,
  notes,
  type Category,
  type Keyword,
  type Article,
  type Bookmark,
  type Note,
  type InsertCategory,
  type InsertKeyword,
  type InsertArticle,
  type InsertBookmark,
  type InsertNote,
  type CategoryWithKeywords,
  type CategoryWithArticles,
  type ArticleWithMetadata,
} from "@shared/schema";
import { db } from "./db";
import { eq, sql, desc, and, gte } from "drizzle-orm";

export interface IStorage {
  // Categories
  getCategories(): Promise<Category[]>;
  getCategoriesWithKeywords(): Promise<CategoryWithKeywords[]>;
  getCategoriesWithArticlesByDate(date: string): Promise<CategoryWithArticles[]>;
  getCategoriesWithArticlesByDateRange(startDate: string, endDate: string): Promise<CategoryWithArticles[]>;
  createCategory(category: InsertCategory): Promise<Category>;

  // Keywords
  getKeywordsByCategoryId(categoryId: string): Promise<Keyword[]>;
  updateKeywordsByCategory(categoryId: string, newKeywords: string[]): Promise<void>;
  
  // Articles
  getArticlesByDate(date: string): Promise<Article[]>;
  getArticleById(articleId: string): Promise<Article | null>;
  getAvailableDates(): Promise<string[]>;
  createArticle(article: InsertArticle): Promise<Article>;
  createArticleWithDate(article: InsertArticle & { crawledDate: Date }): Promise<Article>;
  updateArticle(articleId: string, updates: Partial<InsertArticle>): Promise<Article>;
  deleteArticlesByDate(date: string): Promise<void>;
  deleteArticlesByIds(articleIds: string[]): Promise<void>;
  getArticlesByDateAndCategory(date: string, categoryId: string): Promise<Article[]>;
  getArticlesForExport(startDate: string, endDate: string): Promise<CategoryWithArticles[]>;
  searchArticles(query?: string, startDate?: string, endDate?: string, categoryId?: string): Promise<ArticleWithMetadata[]>;

  // Bookmarks
  toggleBookmark(articleId: string): Promise<boolean>;
  isArticleBookmarked(articleId: string): Promise<boolean>;
  getBookmarkedArticles(): Promise<ArticleWithMetadata[]>;

  // Notes
  getNote(articleId: string): Promise<Note | null>;
  saveNote(articleId: string, content: string): Promise<Note>;
  deleteNote(articleId: string): Promise<void>;

  // Statistics
  getCategoryStats(startDate?: string, endDate?: string): Promise<import("@shared/schema").CategoryStats[]>;
  getDateStats(startDate?: string, endDate?: string): Promise<import("@shared/schema").DateStats[]>;
  getCategoryDateStats(startDate?: string, endDate?: string): Promise<import("@shared/schema").CategoryDateStats[]>;
}

export class DatabaseStorage implements IStorage {
  // Categories
  async getCategories(): Promise<Category[]> {
    return await db.select().from(categories).orderBy(categories.displayOrder);
  }

  async getCategoriesWithKeywords(): Promise<CategoryWithKeywords[]> {
    const allCategories = await db.select().from(categories).orderBy(categories.displayOrder);
    const allKeywords = await db.select().from(keywords);

    return allCategories.map(category => ({
      ...category,
      keywords: allKeywords.filter(k => k.categoryId === category.id),
    }));
  }

  async getCategoriesWithArticlesByDate(date: string): Promise<CategoryWithArticles[]> {
    const allCategories = await db.select().from(categories).orderBy(categories.displayOrder);
    
    // Use SQL DATE() function to compare dates directly without timezone issues
    const articlesWithMetadata = await db
      .select({
        article: articles,
        bookmark: bookmarks,
        note: notes,
      })
      .from(articles)
      .leftJoin(bookmarks, eq(bookmarks.articleId, articles.id))
      .leftJoin(notes, eq(notes.articleId, articles.id))
      .where(
        sql`DATE(${articles.crawledDate}) = ${date}`
      )
      .orderBy(desc(articles.publishedDate));

    const allArticlesWithMetadata: ArticleWithMetadata[] = articlesWithMetadata.map(r => ({
      ...r.article,
      bookmark: r.bookmark,
      note: r.note,
      isBookmarked: !!r.bookmark,
    }));

    return allCategories.map(category => ({
      ...category,
      articles: allArticlesWithMetadata.filter(a => a.categoryId === category.id),
    }));
  }

  async getCategoriesWithArticlesByDateRange(startDate: string, endDate: string): Promise<CategoryWithArticles[]> {
    const allCategories = await db.select().from(categories).orderBy(categories.displayOrder);
    
    // Use SQL DATE() function to compare dates directly without timezone issues
    const articlesWithMetadata = await db
      .select({
        article: articles,
        bookmark: bookmarks,
        note: notes,
      })
      .from(articles)
      .leftJoin(bookmarks, eq(bookmarks.articleId, articles.id))
      .leftJoin(notes, eq(notes.articleId, articles.id))
      .where(
        sql`DATE(${articles.crawledDate}) BETWEEN ${startDate} AND ${endDate}`
      )
      .orderBy(desc(articles.publishedDate));

    const allArticlesWithMetadata: ArticleWithMetadata[] = articlesWithMetadata.map(r => ({
      ...r.article,
      bookmark: r.bookmark,
      note: r.note,
      isBookmarked: !!r.bookmark,
    }));

    return allCategories.map(category => ({
      ...category,
      articles: allArticlesWithMetadata.filter(a => a.categoryId === category.id),
    }));
  }

  async createCategory(category: InsertCategory): Promise<Category> {
    const [newCategory] = await db
      .insert(categories)
      .values(category)
      .returning();
    return newCategory;
  }

  // Keywords
  async getKeywordsByCategoryId(categoryId: string): Promise<Keyword[]> {
    return await db
      .select()
      .from(keywords)
      .where(eq(keywords.categoryId, categoryId));
  }

  async updateKeywordsByCategory(categoryId: string, newKeywords: string[]): Promise<void> {
    // Delete existing keywords for this category
    await db.delete(keywords).where(eq(keywords.categoryId, categoryId));

    // Insert new keywords
    if (newKeywords.length > 0) {
      await db.insert(keywords).values(
        newKeywords.map(keyword => ({
          categoryId,
          keyword,
        }))
      );
    }
  }

  // Articles
  async getArticlesByDate(date: string): Promise<Article[]> {
    // Use SQL DATE() function to compare dates directly without timezone issues
    return await db
      .select()
      .from(articles)
      .where(
        sql`DATE(${articles.crawledDate}) = ${date}`
      )
      .orderBy(desc(articles.publishedDate));
  }

  async getAvailableDates(): Promise<string[]> {
    const result = await db
      .selectDistinct({
        date: sql<string>`DATE(${articles.crawledDate})`,
      })
      .from(articles)
      .orderBy(sql`DATE(${articles.crawledDate}) DESC`);

    return result.map(r => r.date);
  }

  async getArticleById(articleId: string): Promise<Article | null> {
    const [article] = await db
      .select()
      .from(articles)
      .where(eq(articles.id, articleId))
      .limit(1);
    return article || null;
  }

  async createArticle(article: InsertArticle): Promise<Article> {
    const [newArticle] = await db
      .insert(articles)
      .values(article)
      .returning();
    return newArticle;
  }

  async createArticleWithDate(article: InsertArticle & { crawledDate: Date }): Promise<Article> {
    const [newArticle] = await db
      .insert(articles)
      .values(article)
      .returning();
    return newArticle;
  }

  async updateArticle(articleId: string, updates: Partial<InsertArticle>): Promise<Article> {
    const [updatedArticle] = await db
      .update(articles)
      .set(updates)
      .where(eq(articles.id, articleId))
      .returning();
    return updatedArticle;
  }

  async deleteArticlesByDate(date: string): Promise<void> {
    // Use SQL DATE() function to compare dates directly without timezone issues
    await db
      .delete(articles)
      .where(
        sql`DATE(${articles.crawledDate}) = ${date}`
      );
  }

  async deleteArticlesByIds(articleIds: string[]): Promise<void> {
    if (articleIds.length === 0) return;
    
    await db
      .delete(articles)
      .where(sql`${articles.id} IN (${sql.join(articleIds.map(id => sql`${id}`), sql`, `)})`);
  }

  async getArticlesByDateAndCategory(date: string, categoryId: string): Promise<Article[]> {
    // Use SQL DATE() function to compare dates directly without timezone issues
    return await db
      .select()
      .from(articles)
      .where(
        and(
          eq(articles.categoryId, categoryId),
          sql`DATE(${articles.crawledDate}) = ${date}`
        )
      );
  }

  async getArticlesForExport(startDate: string, endDate: string): Promise<CategoryWithArticles[]> {
    const allCategories = await db.select().from(categories).orderBy(categories.displayOrder);
    
    // Use SQL DATE() function to compare dates directly without timezone issues
    const allArticles = await db
      .select()
      .from(articles)
      .where(
        and(
          sql`DATE(${articles.crawledDate}) >= ${startDate}`,
          sql`DATE(${articles.crawledDate}) <= ${endDate}`
        )
      )
      .orderBy(desc(articles.publishedDate));

    return allCategories.map(category => ({
      ...category,
      articles: allArticles.filter(a => a.categoryId === category.id),
    }));
  }

  async searchArticles(
    query?: string,
    startDate?: string,
    endDate?: string,
    categoryId?: string
  ): Promise<ArticleWithMetadata[]> {
    const conditions: any[] = [];

    if (query && query.trim()) {
      conditions.push(
        sql`(${articles.title} ILIKE ${'%' + query + '%'} OR ${articles.summary} ILIKE ${'%' + query + '%'})`
      );
    }

    if (startDate) {
      conditions.push(sql`DATE(${articles.crawledDate}) >= ${startDate}`);
    }

    if (endDate) {
      conditions.push(sql`DATE(${articles.crawledDate}) <= ${endDate}`);
    }

    if (categoryId) {
      conditions.push(eq(articles.categoryId, categoryId));
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    const result = await db
      .select({
        article: articles,
        bookmark: bookmarks,
        note: notes,
      })
      .from(articles)
      .leftJoin(bookmarks, eq(bookmarks.articleId, articles.id))
      .leftJoin(notes, eq(notes.articleId, articles.id))
      .where(whereClause)
      .orderBy(desc(articles.publishedDate));

    return result.map(r => ({
      ...r.article,
      bookmark: r.bookmark,
      note: r.note,
      isBookmarked: !!r.bookmark,
    }));
  }

  // Bookmarks
  async toggleBookmark(articleId: string): Promise<boolean> {
    const existing = await db
      .select()
      .from(bookmarks)
      .where(eq(bookmarks.articleId, articleId))
      .limit(1);

    if (existing.length > 0) {
      await db.delete(bookmarks).where(eq(bookmarks.articleId, articleId));
      return false;
    } else {
      await db.insert(bookmarks).values({ articleId });
      return true;
    }
  }

  async isArticleBookmarked(articleId: string): Promise<boolean> {
    const result = await db
      .select()
      .from(bookmarks)
      .where(eq(bookmarks.articleId, articleId))
      .limit(1);
    return result.length > 0;
  }

  async getBookmarkedArticles(): Promise<ArticleWithMetadata[]> {
    const result = await db
      .select({
        article: articles,
        bookmark: bookmarks,
        note: notes,
      })
      .from(bookmarks)
      .innerJoin(articles, eq(bookmarks.articleId, articles.id))
      .leftJoin(notes, eq(notes.articleId, articles.id))
      .orderBy(desc(bookmarks.createdAt));

    return result.map(r => ({
      ...r.article,
      bookmark: r.bookmark,
      note: r.note,
      isBookmarked: true,
    }));
  }

  // Notes
  async getNote(articleId: string): Promise<Note | null> {
    const result = await db
      .select()
      .from(notes)
      .where(eq(notes.articleId, articleId))
      .limit(1);
    return result[0] || null;
  }

  async saveNote(articleId: string, content: string): Promise<Note> {
    const existing = await db
      .select()
      .from(notes)
      .where(eq(notes.articleId, articleId))
      .limit(1);

    if (existing.length > 0) {
      const [updated] = await db
        .update(notes)
        .set({ content, updatedAt: new Date() })
        .where(eq(notes.articleId, articleId))
        .returning();
      return updated;
    } else {
      const [newNote] = await db
        .insert(notes)
        .values({ articleId, content })
        .returning();
      return newNote;
    }
  }

  async deleteNote(articleId: string): Promise<void> {
    await db.delete(notes).where(eq(notes.articleId, articleId));
  }

  // Statistics
  async getCategoryStats(startDate?: string, endDate?: string): Promise<import("@shared/schema").CategoryStats[]> {
    const allCategories = await db.select().from(categories).orderBy(categories.displayOrder);
    
    // Use SQL DATE() function to compare dates directly without timezone issues
    let dateConditions = [];
    if (startDate) {
      dateConditions.push(sql`DATE(${articles.crawledDate}) >= ${startDate}`);
    }
    if (endDate) {
      dateConditions.push(sql`DATE(${articles.crawledDate}) <= ${endDate}`);
    }

    const allArticles = await db
      .select()
      .from(articles)
      .where(dateConditions.length > 0 ? and(...dateConditions) : undefined);

    return allCategories.map(category => ({
      categoryId: category.id,
      categoryName: category.name,
      count: allArticles.filter(a => a.categoryId === category.id).length,
    }));
  }

  async getDateStats(startDate?: string, endDate?: string): Promise<import("@shared/schema").DateStats[]> {
    // Use SQL DATE() function to compare dates directly without timezone issues
    let dateConditions = [];
    if (startDate) {
      dateConditions.push(sql`DATE(${articles.crawledDate}) >= ${startDate}`);
    }
    if (endDate) {
      dateConditions.push(sql`DATE(${articles.crawledDate}) <= ${endDate}`);
    }

    const result = await db
      .select({
        date: sql<string>`DATE(${articles.crawledDate})`,
        count: sql<number>`COUNT(*)::int`,
      })
      .from(articles)
      .where(dateConditions.length > 0 ? and(...dateConditions) : undefined)
      .groupBy(sql`DATE(${articles.crawledDate})`)
      .orderBy(sql`DATE(${articles.crawledDate})`);

    return result.map(r => ({
      date: r.date,
      count: r.count,
    }));
  }

  async getCategoryDateStats(startDate?: string, endDate?: string): Promise<import("@shared/schema").CategoryDateStats[]> {
    const allCategories = await db.select().from(categories).orderBy(categories.displayOrder);
    
    // Use SQL DATE() function to compare dates directly without timezone issues
    let dateConditions = [];
    if (startDate) {
      dateConditions.push(sql`DATE(${articles.crawledDate}) >= ${startDate}`);
    }
    if (endDate) {
      dateConditions.push(sql`DATE(${articles.crawledDate}) <= ${endDate}`);
    }

    const result = await db
      .select({
        categoryId: articles.categoryId,
        date: sql<string>`DATE(${articles.crawledDate})`,
        count: sql<number>`COUNT(*)::int`,
      })
      .from(articles)
      .where(dateConditions.length > 0 ? and(...dateConditions) : undefined)
      .groupBy(articles.categoryId, sql`DATE(${articles.crawledDate})`)
      .orderBy(sql`DATE(${articles.crawledDate})`);

    return allCategories.map(category => ({
      categoryId: category.id,
      categoryName: category.name,
      stats: result
        .filter(r => r.categoryId === category.id)
        .map(r => ({
          date: r.date,
          count: r.count,
        })),
    }));
  }
}

export const storage = new DatabaseStorage();

import { compareTwoStrings } from "string-similarity";
import { summarizeArticle, selectTopImportantArticles, analyzeAndRankArticles } from "./openai";
import { storage } from "./storage";
import type { CategoryWithKeywords, Article } from "@shared/schema";
import { sendNotification } from "./notifier";
import type { WebSocketServer } from "ws";

// Get Korean Standard Time (KST = UTC+9) date string in YYYY-MM-DD format
function getKSTDateString(): string {
  const now = new Date();
  // Convert to KST by adding 9 hours
  const kstOffset = 9 * 60 * 60 * 1000; // 9 hours in milliseconds
  const kstDate = new Date(now.getTime() + kstOffset);
  
  const year = kstDate.getUTCFullYear();
  const month = String(kstDate.getUTCMonth() + 1).padStart(2, '0');
  const day = String(kstDate.getUTCDate()).padStart(2, '0');
  
  return `${year}-${month}-${day}`;
}

// Get Korean Standard Time (KST = UTC+9) Date object set to 00:00:00
function getKSTDate(): Date {
  const dateStr = getKSTDateString();
  return new Date(`${dateStr}T00:00:00Z`);
}

// Helper function to broadcast crawl progress via WebSocket
function broadcastProgress(message: any) {
  try {
    const wss = (global as any).crawlProgressWss as WebSocketServer | undefined;
    if (wss) {
      const data = JSON.stringify(message);
      wss.clients.forEach((client) => {
        if (client.readyState === 1) { // OPEN
          client.send(data);
        }
      });
    }
  } catch (error) {
    console.error("Failed to broadcast progress:", error);
  }
}

interface NaverNewsItem {
  title: string;
  link: string;
  description: string;
  pubDate: string;
  summary?: string;
  importance?: number;
}

interface NaverSearchResponse {
  items: NaverNewsItem[];
  total: number;
  start: number;
  display: number;
}

// Check if article is within last 3 days
function isWithinThreeDays(pubDate: string): boolean {
  const articleDate = new Date(pubDate);
  const threeDaysAgo = new Date();
  threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);
  return articleDate >= threeDaysAgo;
}

// Check if article is within last N days
function isWithinDays(pubDate: string, days: number): boolean {
  const articleDate = new Date(pubDate);
  const daysAgo = new Date();
  daysAgo.setDate(daysAgo.getDate() - days);
  return articleDate >= daysAgo;
}

// Decode HTML entities (named and numeric)
function decodeHTMLEntities(text: string): string {
  const namedEntities: Record<string, string> = {
    '&quot;': '"',
    '&apos;': "'",
    '&amp;': '&',
    '&lt;': '<',
    '&gt;': '>',
    '&#039;': "'",
    '&nbsp;': ' ',
  };
  
  return text
    // Decode named entities
    .replace(/&[a-z]+;/gi, (match) => namedEntities[match] || match)
    // Decode numeric entities (e.g., &#34;, &#x201c;)
    .replace(/&#(\d+);/g, (match, dec) => String.fromCharCode(parseInt(dec, 10)))
    .replace(/&#x([0-9a-f]+);/gi, (match, hex) => String.fromCharCode(parseInt(hex, 16)));
}

// Clean article title by removing news source suffixes and prefixes
function cleanTitle(title: string): string {
  // Remove common patterns like "- 네이트", "- 조선일보", "| YTN", "(연합뉴스)" etc.
  let cleaned = title
    // Remove prefixes (at the start)
    .replace(/^\[[^\]]+\]\s*/, '')  // Remove "[리포트 브리핑] " at start
    .replace(/^【[^】]+】\s*/, '')    // Remove "【...】 " at start
    .replace(/^\([^)]+\)\s*/, '')   // Remove "(...) " at start
    .trim();
  
  // Remove suffixes ONLY if the remaining title will be at least 5 characters
  // This prevents over-cleaning titles like "달러 - 뉴스1" -> "달러"
  const suffixPatterns = [
    /\s*-\s*[^-]+$/,   // Remove " - NewsSource"
    /\s*\|\s*[^|]+$/,  // Remove " | NewsSource"
    /\s*\([^)]+\)$/,   // Remove " (NewsSource)"
    /\s*【[^】]+】$/,    // Remove " 【NewsSource】"
    /\s*\[[^\]]+\]$/,  // Remove " [NewsSource]"
  ];
  
  for (const pattern of suffixPatterns) {
    const testResult = cleaned.replace(pattern, '').trim();
    // Only apply the replacement if it leaves at least 5 characters
    if (testResult.length >= 5) {
      cleaned = testResult;
    }
  }
  
  return cleaned.trim();
}

// Fetch articles for a keyword from Naver Search API
export async function fetchArticlesForKeyword(keyword: string): Promise<NaverNewsItem[]> {
  try {
    const clientId = process.env.NAVER_CLIENT_ID;
    const clientSecret = process.env.NAVER_CLIENT_SECRET;
    
    if (!clientId || !clientSecret) {
      throw new Error("NAVER_CLIENT_ID 또는 NAVER_CLIENT_SECRET이 설정되지 않았습니다.");
    }

    const encodedKeyword = encodeURIComponent(keyword);
    const url = `https://openapi.naver.com/v1/search/news.json?query=${encodedKeyword}&display=100&sort=date`;
    
    // Add a small delay to avoid rate limiting (50ms)
    await new Promise(resolve => setTimeout(resolve, 50));
    
    const response = await fetch(url, {
      headers: {
        "X-Naver-Client-Id": clientId,
        "X-Naver-Client-Secret": clientSecret,
      },
    });

    if (!response.ok) {
      throw new Error(`Naver API error: ${response.status} ${response.statusText}`);
    }

    const data: NaverSearchResponse = await response.json();
    
    // Filter articles within last 3 days
    const recentArticles = data.items.filter(item => item.pubDate && isWithinThreeDays(item.pubDate));
    
    // Filter articles that contain the keyword in title
    const keywordLower = keyword.toLowerCase();
    const relevantArticles = recentArticles.filter(item => {
      const titleText = item.title.replace(/<\/?b>/g, "").toLowerCase();
      return titleText.includes(keywordLower);
    });
    
    // Clean titles
    const articles = relevantArticles.map(item => {
      const originalTitle = item.title.replace(/<\/?b>/g, "");
      const decodedTitle = decodeHTMLEntities(originalTitle);
      const cleanedTitle = cleanTitle(decodedTitle);
      
      // Log if title was drastically shortened (potential over-cleaning)
      if (cleanedTitle.length < 10 && decodedTitle.length > 20) {
        console.warn(`    ⚠️ Title possibly over-cleaned for keyword "${keyword}":
        Original: "${decodedTitle}"
        Cleaned:  "${cleanedTitle}"`);
      }
      
      return {
        ...item,
        title: cleanedTitle,
        description: decodeHTMLEntities(item.description.replace(/<\/?b>/g, "")),
      };
    });

    return articles;
  } catch (error) {
    console.error(`Failed to fetch articles for keyword "${keyword}":`, error);
    return [];
  }
}

// Filter out promotional/event articles based on keywords
function filterPromotionalArticles(articles: NaverNewsItem[]): NaverNewsItem[] {
  const promotionalKeywords = [
    '인기', '호평', '주목', '관심',
    '전시', '박람회', '행사', '이벤트', '개최',
    '캠페인', '홍보', '광고', '마케팅', '프로모션',
    '후원', '기부', '봉사', '나눔', 'CSR',
    '팝업', '체험관', '스폰서', '초청', '클래스', '교실', '놀이터',
    '친환경', '지속가능', '탄소중립',
    '판다', '루이', '후이', // Panda-related
  ];
  
  return articles.filter(article => {
    const titleLower = article.title.toLowerCase();
    const descLower = article.description.toLowerCase();
    const textToCheck = titleLower + ' ' + descLower;
    
    const hasPromotionalKeyword = promotionalKeywords.some(keyword => 
      textToCheck.includes(keyword.toLowerCase())
    );
    return !hasPromotionalKeyword;
  });
}

// Find the most important article using GPT, then select the longest one among top candidates
async function findRepresentativeArticle(articles: NaverNewsItem[]): Promise<NaverNewsItem | null> {
  if (articles.length === 0) return null;
  if (articles.length === 1) return articles[0];

  try {
    // Step 0: Filter out promotional articles BEFORE sending to GPT
    const filteredArticles = filterPromotionalArticles(articles);
    if (filteredArticles.length === 0) {
      console.warn(`    All ${articles.length} articles filtered out as promotional, skipping keyword`);
      return null;
    }
    if (filteredArticles.length < articles.length) {
      console.log(`    Filtered ${articles.length - filteredArticles.length} promotional articles (${filteredArticles.length} remaining)`);
    }

    // Step 1: Use GPT to select top 3 most important articles from filtered set
    const topN = Math.min(3, filteredArticles.length);
    const topIndices = await selectTopImportantArticles(
      filteredArticles.map(a => ({ title: a.title, description: a.description })),
      topN
    );

    if (topIndices.length === 0) {
      console.warn("    GPT returned no indices, skipping keyword");
      return null;
    }

    // Step 2: Among top articles, select the one with longest description
    const topArticles = topIndices
      .filter(i => i >= 0 && i < filteredArticles.length) // Ensure valid indices for filteredArticles
      .map(i => filteredArticles[i])
      .filter(a => a && a.title && a.description); // Ensure valid articles
    
    if (topArticles.length === 0) {
      console.warn("    No valid articles from GPT selection, skipping keyword");
      return null;
    }

    topArticles.sort((a, b) => b.description.length - a.description.length);

    const selected = topArticles[0];
    console.log(`    GPT selected top ${topArticles.length} articles, choosing longest: "${selected.title?.substring(0, 50)}..." (${selected.description?.length || 0} chars)`);
    
    return selected;
  } catch (error) {
    console.error("    Failed to use GPT selection, falling back to similarity-based selection:", error);
    
    // Fallback to old similarity-based method
    const similarityScores = articles.map((article, index) => {
      let totalSimilarity = 0;
      for (let i = 0; i < articles.length; i++) {
        if (i !== index) {
          const similarity = compareTwoStrings(
            article.title + " " + article.description,
            articles[i].title + " " + articles[i].description
          );
          totalSimilarity += similarity;
        }
      }
      return {
        article,
        avgSimilarity: totalSimilarity / (articles.length - 1),
      };
    });

    similarityScores.sort((a, b) => b.avgSimilarity - a.avgSimilarity);
    return similarityScores[0].article;
  }
}

// Process a single keyword within a category
async function processKeyword(
  category: CategoryWithKeywords,
  keywordObj: { id: string; categoryId: string; keyword: string },
  keywordIndex: number,
  totalKeywords: number,
  crawledDate: Date
): Promise<(Article & { category: CategoryWithKeywords }) | null> {
  try {
    const keyword = keywordObj.keyword;
    console.log(`  [${keywordIndex + 1}/${totalKeywords}] Processing keyword: ${keyword}`);
    
    broadcastProgress({
      type: "keyword_started",
      categoryId: category.id,
      categoryName: category.name,
      keyword: keyword,
      keywordIndex: keywordIndex + 1,
      totalKeywords: totalKeywords,
    });

    // Fetch articles for this keyword
    const articles = await fetchArticlesForKeyword(keyword);

    broadcastProgress({
      type: "keyword_articles_found",
      categoryId: category.id,
      categoryName: category.name,
      keyword: keyword,
      articleCount: articles.length,
    });

    if (articles.length === 0) {
      console.log(`    No articles found for keyword: ${keyword}`);
      broadcastProgress({
        type: "keyword_completed",
        categoryId: category.id,
        categoryName: category.name,
        keyword: keyword,
        success: false,
        reason: "기사 없음",
      });
      return null;
    }

    // Find the most representative article for this keyword
    const representativeArticle = await findRepresentativeArticle(articles);

    if (!representativeArticle) {
      console.log(`    Could not determine representative article for keyword: ${keyword}`);
      broadcastProgress({
        type: "keyword_completed",
        categoryId: category.id,
        categoryName: category.name,
        keyword: keyword,
        success: false,
        reason: "대표 기사 선정 실패",
      });
      return null;
    }

    console.log(`    Selected article: ${representativeArticle.title}`);
    broadcastProgress({
      type: "keyword_article_selected",
      categoryId: category.id,
      categoryName: category.name,
      keyword: keyword,
      articleTitle: representativeArticle.title,
    });

    // Summarize the article using gpt-5-nano
    broadcastProgress({
      type: "keyword_summarizing",
      categoryId: category.id,
      categoryName: category.name,
      keyword: keyword,
    });

    const contentToSummarize = representativeArticle.description || representativeArticle.title;
    let summary: string;
    
    try {
      summary = await summarizeArticle(contentToSummarize);
    } catch (error) {
      // If summarization fails, leave summary empty
      console.warn(`    ⚠ Failed to summarize, leaving summary empty: ${error instanceof Error ? error.message : "Unknown error"}`);
      summary = "";
    }

    // Save to database with Korean date
    const newArticle = await storage.createArticleWithDate({
      categoryId: category.id,
      keyword: keyword,
      title: representativeArticle.title,
      summary,
      url: representativeArticle.link,
      publishedDate: new Date(representativeArticle.pubDate),
      crawledDate: crawledDate,
    });

    console.log(`    ✓ Saved article for keyword: ${keyword}`);
    broadcastProgress({
      type: "keyword_completed",
      categoryId: category.id,
      categoryName: category.name,
      keyword: keyword,
      success: true,
      articleTitle: representativeArticle.title,
    });
    
    return {
      ...newArticle,
      category,
    };
  } catch (error) {
    console.error(`    ✗ Failed to process keyword ${keywordObj.keyword}:`, error);
    broadcastProgress({
      type: "keyword_error",
      categoryId: category.id,
      categoryName: category.name,
      keyword: keywordObj.keyword,
      error: error instanceof Error ? error.message : "알 수 없는 오류",
    });
    return null;
  }
}

// Process a single category (now processes all keywords)
async function processCategoryParallel(category: CategoryWithKeywords, crawledDate: Date): Promise<(Article & { category: CategoryWithKeywords })[]> {
  try {
    console.log(`Processing category: ${category.name} (${category.keywords.length} keywords)`);
    broadcastProgress({
      type: "category_started",
      categoryId: category.id,
      categoryName: category.name,
      keywordCount: category.keywords.length,
    });

    if (category.keywords.length === 0) {
      console.log(`  No keywords for category ${category.name}, skipping.`);
      broadcastProgress({
        type: "category_skipped",
        categoryId: category.id,
        categoryName: category.name,
        reason: "키워드 없음",
      });
      return [];
    }

    // Process keywords in batches to avoid rate limiting
    const BATCH_SIZE = 5;
    const BATCH_DELAY = 500; // milliseconds between batches
    
    const allResults: PromiseSettledResult<(Article & { category: CategoryWithKeywords }) | null>[] = [];
    const totalBatches = Math.ceil(category.keywords.length / BATCH_SIZE);
    
    console.log(`  Processing ${category.keywords.length} keywords in ${totalBatches} batches (${BATCH_SIZE} per batch)`);

    for (let i = 0; i < category.keywords.length; i += BATCH_SIZE) {
      const batch = category.keywords.slice(i, i + BATCH_SIZE);
      const batchNumber = Math.floor(i / BATCH_SIZE) + 1;
      
      console.log(`  Batch ${batchNumber}/${totalBatches}: Processing ${batch.length} keywords`);
      
      const batchPromises = batch.map((keywordObj, batchIndex) => 
        processKeyword(category, keywordObj, i + batchIndex, category.keywords.length, crawledDate)
      );
      
      const batchResults = await Promise.allSettled(batchPromises);
      allResults.push(...batchResults);
      
      // Add delay between batches (except after the last batch)
      if (i + BATCH_SIZE < category.keywords.length) {
        console.log(`  Waiting ${BATCH_DELAY}ms before next batch...`);
        await new Promise(resolve => setTimeout(resolve, BATCH_DELAY));
      }
    }

    const results = allResults;
    
    // Extract successful articles and count failures
    const articles = results
      .filter((result): result is PromiseFulfilledResult<Article & { category: CategoryWithKeywords } | null> => 
        result.status === "fulfilled" && result.value !== null
      )
      .map(result => result.value as Article & { category: CategoryWithKeywords });

    const failedCount = category.keywords.length - articles.length;
    const hasSuccess = articles.length > 0;
    const totalSuccess = failedCount === 0;

    console.log(`  ${totalSuccess ? '✓' : '⚠'} Category ${category.name} completed: ${articles.length}/${category.keywords.length} articles saved`);
    
    let statusMessage: string;
    if (totalSuccess) {
      statusMessage = `완료 (${articles.length}개 기사 수집)`;
    } else if (hasSuccess) {
      statusMessage = `부분 완료 (${articles.length}/${category.keywords.length} 기사 수집)`;
    } else {
      statusMessage = "뉴스 없음 (모든 키워드에서 기사 없음)";
    }

    broadcastProgress({
      type: "category_completed",
      categoryId: category.id,
      categoryName: category.name,
      success: hasSuccess, // true if at least one article was collected
      totalSuccess: totalSuccess, // true only if all keywords succeeded
      articlesCount: articles.length,
      totalKeywords: category.keywords.length,
      failedKeywords: failedCount,
      reason: statusMessage,
    });
    
    return articles;
  } catch (error) {
    console.error(`  ✗ Failed to process category ${category.name}:`, error);
    broadcastProgress({
      type: "category_error",
      categoryId: category.id,
      categoryName: category.name,
      error: error instanceof Error ? error.message : "알 수 없는 오류",
    });
    return [];
  }
}

// Crawl articles for all categories sequentially to avoid rate limiting
export async function crawlNews(): Promise<void> {
  console.log("Starting sequential news crawling...");
  
  const startTime = Date.now();
  
  // Get Korean Standard Time today's date
  const todayKST = getKSTDateString();
  const crawledDate = getKSTDate();
  
  console.log(`Crawling for Korean date: ${todayKST}`);
  
  // Delete existing articles for today before starting new crawl
  console.log(`Deleting existing articles for ${todayKST}...`);
  await storage.deleteArticlesByDate(todayKST);
  
  // Get all categories with keywords
  const categories = await storage.getCategoriesWithKeywords();
  
  broadcastProgress({
    type: "crawl_started",
    totalCategories: categories.length,
    categories: categories.map(c => ({ id: c.id, name: c.name })),
    timestamp: new Date().toISOString(),
    crawlDate: todayKST,
  });
  
  // Process categories SEQUENTIALLY to avoid overwhelming the API
  const newArticles: (Article & { category: CategoryWithKeywords })[] = [];
  
  for (let i = 0; i < categories.length; i++) {
    const category = categories[i];
    console.log(`\n[${i + 1}/${categories.length}] Starting category: ${category.name}`);
    
    try {
      const articles = await processCategoryParallel(category, crawledDate);
      newArticles.push(...articles);
    } catch (error) {
      console.error(`Failed to process category ${category.name}:`, error);
    }
    
    // Add delay between categories (except after the last one)
    if (i < categories.length - 1) {
      const CATEGORY_DELAY = 1000; // 1 second between categories
      console.log(`Waiting ${CATEGORY_DELAY}ms before next category...`);
      await new Promise(resolve => setTimeout(resolve, CATEGORY_DELAY));
    }
  }

  const duration = Date.now() - startTime;
  console.log(`News crawling completed! Created ${newArticles.length} articles in ${duration}ms.`);
  
  // Send notifications about new articles
  if (newArticles.length > 0) {
    console.log(`Sending notifications for ${newArticles.length} new articles...`);
    try {
      await sendNotification(newArticles);
    } catch (error) {
      console.error("Failed to send notifications:", error);
    }
  }

  broadcastProgress({
    type: "crawl_completed",
    totalArticles: newArticles.length,
    duration,
    timestamp: new Date().toISOString(),
  });
}

// Live news search - search Naver API in real-time, use GPT to deduplicate and rank by importance
export async function searchLiveNews(query: string, daysBack: number = 7): Promise<NaverNewsItem[]> {
  try {
    const clientId = process.env.NAVER_CLIENT_ID;
    const clientSecret = process.env.NAVER_CLIENT_SECRET;
    
    if (!clientId || !clientSecret) {
      throw new Error("NAVER_CLIENT_ID 또는 NAVER_CLIENT_SECRET이 설정되지 않았습니다.");
    }

    console.log(`Searching live news for: "${query}" (last ${daysBack} days)`);
    
    const encodedQuery = encodeURIComponent(query);
    const url = `https://openapi.naver.com/v1/search/news.json?query=${encodedQuery}&display=100&sort=date`;
    
    const response = await fetch(url, {
      headers: {
        "X-Naver-Client-Id": clientId,
        "X-Naver-Client-Secret": clientSecret,
      },
    });

    if (!response.ok) {
      throw new Error(`Naver API error: ${response.status} ${response.statusText}`);
    }

    const data: NaverSearchResponse = await response.json();
    
    // Filter articles within specified days
    const recentArticles = data.items.filter(item => 
      item.pubDate && isWithinDays(item.pubDate, daysBack)
    );
    
    console.log(`Found ${recentArticles.length} articles within last ${daysBack} days`);
    
    // Clean and decode titles
    const cleanedArticles = recentArticles.map(item => ({
      title: cleanTitle(decodeHTMLEntities(item.title.replace(/<\/?b>/g, ""))),
      description: decodeHTMLEntities(item.description.replace(/<\/?b>/g, "")),
      link: item.link,
      pubDate: item.pubDate,
    }));

    // Use GPT to analyze articles: deduplicate, rank by importance, and generate summaries
    const analyzedArticles = await analyzeAndRankArticles(cleanedArticles);
    
    console.log(`After GPT analysis: ${analyzedArticles.length} articles (sorted by importance)`);
    
    return analyzedArticles;
  } catch (error) {
    console.error(`Failed to search live news for "${query}":`, error);
    throw error;
  }
}

// Remove duplicate articles based on title similarity
function removeDuplicateArticles(articles: NaverNewsItem[]): NaverNewsItem[] {
  if (articles.length <= 1) return articles;

  const uniqueArticles: NaverNewsItem[] = [];
  const SIMILARITY_THRESHOLD = 0.7; // Consider articles with >70% similarity as duplicates

  for (const article of articles) {
    // Check if this article is similar to any already selected article
    const isDuplicate = uniqueArticles.some(uniqueArticle => {
      const similarity = compareTwoStrings(
        article.title.toLowerCase(),
        uniqueArticle.title.toLowerCase()
      );
      return similarity > SIMILARITY_THRESHOLD;
    });

    if (!isDuplicate) {
      uniqueArticles.push(article);
    }
  }

  return uniqueArticles;
}

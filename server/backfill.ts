import { compareTwoStrings } from "string-similarity";
import { summarizeArticle } from "./openai";
import { storage } from "./storage";
import type { CategoryWithKeywords, Article } from "@shared/schema";

interface NaverNewsItem {
  title: string;
  link: string;
  description: string;
  pubDate: string;
}

interface NaverSearchResponse {
  items: NaverNewsItem[];
  total: number;
  start: number;
  display: number;
}

// Decode HTML entities
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
    .replace(/&[a-z]+;/gi, (match) => namedEntities[match] || match)
    .replace(/&#(\d+);/g, (match, dec) => String.fromCharCode(parseInt(dec, 10)))
    .replace(/&#x([0-9a-f]+);/gi, (match, hex) => String.fromCharCode(parseInt(hex, 16)));
}

// Clean article title
function cleanTitle(title: string): string {
  return title
    .replace(/^\[[^\]]+\]\s*/, '')
    .replace(/^【[^】]+】\s*/, '')
    .replace(/^\([^)]+\)\s*/, '')
    .replace(/\s*-\s*[^-]+$/, '')
    .replace(/\s*\|\s*[^|]+$/, '')
    .replace(/\s*\([^)]+\)$/, '')
    .replace(/\s*【[^】]+】$/, '')
    .replace(/\s*\[[^\]]+\]$/, '')
    .trim();
}

// Check if article is within date range (targetDate - 3 days to targetDate)
function isWithinDateRange(pubDate: string, targetDate: Date): boolean {
  const articleDate = new Date(pubDate);
  const threeDaysBeforeTarget = new Date(targetDate);
  threeDaysBeforeTarget.setDate(threeDaysBeforeTarget.getDate() - 3);
  
  return articleDate >= threeDaysBeforeTarget && articleDate <= targetDate;
}

// Fetch articles for a keyword from Naver Search API for a specific target date
async function fetchArticlesForKeywordAndDate(keyword: string, targetDate: Date): Promise<NaverNewsItem[]> {
  try {
    const clientId = process.env.NAVER_CLIENT_ID;
    const clientSecret = process.env.NAVER_CLIENT_SECRET;
    
    if (!clientId || !clientSecret) {
      throw new Error("NAVER_CLIENT_ID 또는 NAVER_CLIENT_SECRET이 설정되지 않았습니다.");
    }

    const encodedKeyword = encodeURIComponent(keyword);
    const url = `https://openapi.naver.com/v1/search/news.json?query=${encodedKeyword}&display=100&sort=date`;
    
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
    
    // Filter articles within target date range (targetDate - 3 days to targetDate)
    const recentArticles = data.items.filter(item => 
      item.pubDate && isWithinDateRange(item.pubDate, targetDate)
    );
    
    // Filter articles that contain the keyword in title
    const keywordLower = keyword.toLowerCase();
    const relevantArticles = recentArticles.filter(item => {
      const titleText = item.title.replace(/<\/?b>/g, "").toLowerCase();
      return titleText.includes(keywordLower);
    });
    
    // Clean titles
    const articles = relevantArticles.map(item => ({
      ...item,
      title: cleanTitle(decodeHTMLEntities(item.title.replace(/<\/?b>/g, ""))),
      description: decodeHTMLEntities(item.description.replace(/<\/?b>/g, "")),
    }));

    return articles;
  } catch (error) {
    console.error(`Failed to fetch articles for keyword "${keyword}":`, error);
    return [];
  }
}

// Filter out promotional articles
function filterPromotionalArticles(articles: NaverNewsItem[]): NaverNewsItem[] {
  const promotionalKeywords = [
    "할인", "이벤트", "프로모션", "증정", "경품",
    "쿠폰", "특가", "세일", "무료", "공짜",
    "선착순", "추첨", "응모", "참여", "혜택"
  ];
  
  return articles.filter(article => {
    const titleLower = article.title.toLowerCase();
    const descLower = article.description.toLowerCase();
    
    return !promotionalKeywords.some(keyword => 
      titleLower.includes(keyword) || descLower.includes(keyword)
    );
  });
}

// Find the most representative article
async function findRepresentativeArticle(articles: NaverNewsItem[]): Promise<NaverNewsItem | null> {
  if (articles.length === 0) return null;
  if (articles.length === 1) return articles[0];

  const filteredArticles = filterPromotionalArticles(articles);
  if (filteredArticles.length === 0) return articles[0];
  if (filteredArticles.length === 1) return filteredArticles[0];

  const titles = filteredArticles.map(a => a.title);
  const similarityScores: number[] = [];

  for (let i = 0; i < titles.length; i++) {
    let totalSimilarity = 0;
    for (let j = 0; j < titles.length; j++) {
      if (i !== j) {
        totalSimilarity += compareTwoStrings(titles[i], titles[j]);
      }
    }
    const averageSimilarity = totalSimilarity / (titles.length - 1);
    similarityScores.push(averageSimilarity);
  }

  const maxSimilarityIndex = similarityScores.indexOf(Math.max(...similarityScores));
  return filteredArticles[maxSimilarityIndex];
}

// Process a single keyword for a specific date
async function processKeywordForDate(
  category: CategoryWithKeywords,
  keywordObj: { id: string; categoryId: string; keyword: string },
  targetDate: Date,
  crawledDate: Date
): Promise<Article | null> {
  try {
    const keyword = keywordObj.keyword;
    
    // Fetch articles for this keyword
    const articles = await fetchArticlesForKeywordAndDate(keyword, targetDate);

    if (articles.length === 0) {
      return null;
    }

    // Find the most representative article
    const representativeArticle = await findRepresentativeArticle(articles);

    if (!representativeArticle) {
      return null;
    }

    // Summarize the article using GPT
    const contentToSummarize = representativeArticle.description || representativeArticle.title;
    let summary: string;
    
    try {
      summary = await summarizeArticle(contentToSummarize);
    } catch (error) {
      console.warn(`Failed to summarize, leaving summary empty: ${error instanceof Error ? error.message : "Unknown error"}`);
      summary = "";
    }

    // Save to database with the target crawledDate
    const newArticle = await storage.createArticleWithDate({
      categoryId: category.id,
      title: representativeArticle.title,
      summary,
      url: representativeArticle.link,
      publishedDate: new Date(representativeArticle.pubDate),
      crawledDate: crawledDate,
    });

    return newArticle;
  } catch (error) {
    console.error(`Failed to process keyword ${keywordObj.keyword}:`, error);
    return null;
  }
}

// Process a category for a specific date
async function processCategoryForDate(
  category: CategoryWithKeywords,
  targetDate: Date,
  crawledDate: Date
): Promise<Article[]> {
  if (category.keywords.length === 0) {
    return [];
  }

  const BATCH_SIZE = 5;
  const BATCH_DELAY = 500;
  
  const allResults: PromiseSettledResult<Article | null>[] = [];
  
  for (let i = 0; i < category.keywords.length; i += BATCH_SIZE) {
    const batch = category.keywords.slice(i, i + BATCH_SIZE);
    
    const batchPromises = batch.map(keywordObj => 
      processKeywordForDate(category, keywordObj, targetDate, crawledDate)
    );
    
    const batchResults = await Promise.allSettled(batchPromises);
    allResults.push(...batchResults);
    
    if (i + BATCH_SIZE < category.keywords.length) {
      await new Promise(resolve => setTimeout(resolve, BATCH_DELAY));
    }
  }

  const articles = allResults
    .filter((result): result is PromiseFulfilledResult<Article | null> => 
      result.status === "fulfilled" && result.value !== null
    )
    .map(result => result.value as Article);

  return articles;
}

// Backfill news for a specific date
async function backfillNewsForDate(date: Date): Promise<void> {
  const dateStr = date.toISOString().split('T')[0];
  console.log(`\nBackfilling news for ${dateStr}...`);
  
  // Get all categories with keywords
  const categories = await storage.getCategoriesWithKeywords();
  
  let totalArticles = 0;
  
  for (let i = 0; i < categories.length; i++) {
    const category = categories[i];
    console.log(`[${i + 1}/${categories.length}] Processing category: ${category.name}`);
    
    try {
      const articles = await processCategoryForDate(category, date, date);
      totalArticles += articles.length;
      console.log(`  ✓ Saved ${articles.length} articles for ${category.name}`);
    } catch (error) {
      console.error(`  ✗ Failed to process category ${category.name}:`, error);
    }
    
    // Add delay between categories
    if (i < categories.length - 1) {
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }
  
  console.log(`✓ Completed ${dateStr}: ${totalArticles} articles saved`);
}

// Main backfill function
export async function backfillNews(daysBack: number = 90): Promise<void> {
  console.log(`Starting backfill for the last ${daysBack} days...`);
  
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  // Generate dates from (today - daysBack) to (today - 1)
  const dates: Date[] = [];
  for (let i = daysBack; i >= 1; i--) {
    const date = new Date(today);
    date.setDate(date.getDate() - i);
    dates.push(date);
  }
  
  console.log(`Will backfill ${dates.length} days from ${dates[0].toISOString().split('T')[0]} to ${dates[dates.length - 1].toISOString().split('T')[0]}`);
  
  for (let i = 0; i < dates.length; i++) {
    const date = dates[i];
    console.log(`\n=== Progress: ${i + 1}/${dates.length} ===`);
    
    try {
      await backfillNewsForDate(date);
    } catch (error) {
      console.error(`Failed to backfill for ${date.toISOString().split('T')[0]}:`, error);
    }
    
    // Add a delay between dates to avoid overwhelming the API
    if (i < dates.length - 1) {
      console.log("Waiting 2 seconds before next date...");
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
  }
  
  console.log("\n✓ Backfill completed!");
}

// Run if called directly
const isMainModule = import.meta.url === `file://${process.argv[1]}`;
if (isMainModule) {
  console.log("Starting 3-month backfill...");
  backfillNews(90)
    .then(() => {
      console.log("Backfill finished successfully!");
      process.exit(0);
    })
    .catch((error) => {
      console.error("Backfill failed:", error);
      process.exit(1);
    });
}

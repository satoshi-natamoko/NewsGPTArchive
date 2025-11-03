// Reference: javascript_openai blueprint
import OpenAI from "openai";

// Using gpt-4o-mini for stable and cost-effective summarization
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// Select top N most important articles from a list
export async function selectTopImportantArticles(
  articles: Array<{ title: string; description: string }>,
  topN: number = 3
): Promise<number[]> {
  try {
    if (!process.env.OPENAI_API_KEY) {
      throw new Error("OPENAI_API_KEY가 설정되지 않았습니다.");
    }

    if (articles.length === 0) {
      return [];
    }

    if (articles.length <= topN) {
      // If we have fewer articles than requested, return all indices
      return Array.from({ length: articles.length }, (_, i) => i);
    }

    // Create a numbered list of articles for GPT
    const articleList = articles
      .map((article, index) => {
        const shortTitle = article.title.substring(0, 100);
        const shortDesc = article.description.substring(0, 150);
        return `${index}. [제목] ${shortTitle} [본문] ${shortDesc}`;
      })
      .join("\n\n");

    const prompt = `다음 ${articles.length}개 뉴스 중 기업 실적·계약·투자·인사·소송 같은 비즈니스 변화가 있는 ${topN}개를 선택하세요.

선택 기준:
- 실적/공시, 계약/수주, 투자/M&A, 임원인사, 소송/제재, 특허/기술개발
- 제외: 전시·행사·캠페인·후원·기부·CSR·인기·호평·주목

기사:
${articleList}

비즈니스 변화 있는 ${topN}개 번호: [0, 1, 2]`;

    console.log(`[OpenAI] Requesting top ${topN} articles from ${articles.length} articles...`);

    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: prompt }],
      max_completion_tokens: 100,
    });

    const choice = response.choices[0];
    const content = choice?.message?.content?.trim();

    if (!content) {
      throw new Error("GPT 응답이 비어있습니다.");
    }

    console.log(`[OpenAI] Raw response: ${content}`);

    // Parse the response - expect format like [0, 3, 5] or 0, 3, 5
    const match = content.match(/\[([0-9,\s]+)\]/) || content.match(/^([0-9,\s]+)$/);
    
    if (!match) {
      console.warn(`[OpenAI] Could not parse response: ${content}, falling back to first ${topN} articles`);
      return Array.from({ length: topN }, (_, i) => i);
    }

    const indices = match[1]
      .split(',')
      .map(s => parseInt(s.trim()))
      .filter(n => !isNaN(n) && n >= 0 && n < articles.length)
      .slice(0, topN);

    if (indices.length === 0) {
      console.warn(`[OpenAI] No valid indices found, falling back to first ${topN} articles`);
      return Array.from({ length: topN }, (_, i) => i);
    }

    console.log(`[OpenAI] Selected top ${indices.length} articles: [${indices.join(', ')}]`);
    return indices;
  } catch (error: any) {
    console.error("[OpenAI] Failed to select top articles:", {
      error: error.message,
      status: error.status,
    });
    
    // Fallback: return first topN articles
    const fallbackIndices = Array.from({ length: Math.min(topN, articles.length) }, (_, i) => i);
    console.log(`[OpenAI] Falling back to first ${fallbackIndices.length} articles`);
    return fallbackIndices;
  }
}

// Analyze articles for live search: remove duplicates, rank by importance, and generate summaries
export async function analyzeAndRankArticles(
  articles: Array<{ title: string; description: string; link: string; pubDate: string }>
): Promise<Array<{ title: string; description: string; link: string; pubDate: string; summary: string; importance: number }>> {
  try {
    if (!process.env.OPENAI_API_KEY) {
      console.warn("OPENAI_API_KEY가 설정되지 않았습니다. GPT 분석을 건너뜁니다.");
      return articles.map(article => ({
        ...article,
        summary: article.description.substring(0, 150),
        importance: 5
      }));
    }

    if (articles.length === 0) {
      return [];
    }

    console.log(`[OpenAI] Analyzing ${articles.length} articles for live search...`);

    // Create article list for GPT
    const articleList = articles
      .map((article, index) => `${index}. [제목] ${article.title}\n[설명] ${article.description.substring(0, 200)}`)
      .join("\n\n");

    const prompt = `다음 뉴스 기사들을 분석해주세요.

기사 목록:
${articleList}

다음 작업을 수행하고 JSON 형식으로 응답해주세요:
1. 중복/유사한 기사는 하나만 남기고 제외 (같은 사건을 다룬 기사)
2. 남은 기사들의 중요도를 1-10으로 평가 (실적/계약/투자/인사/소송 등 비즈니스 변화가 큰 기사일수록 높은 점수)
3. 각 기사를 2-3줄로 요약

응답 형식 (JSON 배열):
[
  {
    "index": 0,
    "importance": 8,
    "summary": "삼성전자가 AI 반도체 부문에서 3조원 규모의 투자를 발표했습니다. 이는 글로벌 AI 시장 경쟁력 강화를 위한 전략적 결정입니다."
  },
  ...
]

중요: 중복 제거 후 최대 20개 기사만 반환하세요.`;

    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: prompt }],
      max_completion_tokens: 3000,
    });

    const content = response.choices[0]?.message?.content?.trim();
    
    if (!content) {
      throw new Error("GPT 응답이 비어있습니다.");
    }

    console.log(`[OpenAI] Raw response: ${content.substring(0, 200)}...`);

    // Parse JSON response
    const jsonMatch = content.match(/\[[\s\S]*\]/);
    if (!jsonMatch) {
      console.warn("[OpenAI] Could not parse JSON, using fallback");
      throw new Error("JSON 파싱 실패");
    }

    const analyzed = JSON.parse(jsonMatch[0]);
    
    // Map analyzed data back to articles
    const results = analyzed
      .filter((item: any) => item.index >= 0 && item.index < articles.length)
      .map((item: any) => ({
        ...articles[item.index],
        summary: item.summary || articles[item.index].description.substring(0, 150),
        importance: item.importance || 5
      }))
      .sort((a: any, b: any) => b.importance - a.importance); // Sort by importance

    console.log(`[OpenAI] Analysis complete. ${results.length} articles after deduplication and ranking.`);
    
    return results;
  } catch (error: any) {
    console.error("[OpenAI] Failed to analyze articles:", error.message);
    
    // Fallback: return all articles with basic summaries
    return articles.slice(0, 20).map(article => ({
      ...article,
      summary: article.description.substring(0, 150),
      importance: 5
    }));
  }
}

export async function summarizeArticle(text: string): Promise<string> {
  try {
    // Check if API key exists
    if (!process.env.OPENAI_API_KEY) {
      throw new Error("OPENAI_API_KEY가 설정되지 않았습니다.");
    }

    // Limit input text to avoid token limits
    const limitedText = text.length > 3000 ? text.substring(0, 3000) + "..." : text;
    
    const prompt = `다음 뉴스를 2-3줄로 요약: ${limitedText}`;

    console.log(`[OpenAI] Requesting summary for text (${limitedText.length} chars)...`);
    
    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: prompt }],
      max_completion_tokens: 1000,
    });

    const choice = response.choices[0];
    const summary = choice?.message?.content;
    
    // Check for truncation
    if (choice?.finish_reason === "length") {
      console.warn("[OpenAI] Response was truncated (finish_reason: length)");
      // Still use the truncated summary if available
      if (summary) {
        console.log(`[OpenAI] Using truncated summary (${summary.length} chars)`);
        return summary.trim();
      }
    }
    
    if (!summary || summary.trim().length === 0) {
      console.error("[OpenAI] No summary in response:", {
        finish_reason: choice?.finish_reason,
        has_content: !!summary,
        content_length: summary?.length || 0,
      });
      throw new Error("응답에 요약 내용이 없습니다.");
    }

    // Check if GPT returned a meta-message refusing to summarize
    const metaMessagePatterns = [
      "기사 본문",
      "링크를 보내주시면",
      "제목만으로",
      "정확한 요약이 어렵",
      "더 자세한 내용",
      "전체 내용을"
    ];
    
    const hasMetaMessage = metaMessagePatterns.some(pattern => 
      summary.includes(pattern)
    );
    
    if (hasMetaMessage) {
      console.warn("[OpenAI] GPT refused to summarize (meta-message detected)");
      throw new Error("GPT가 요약을 거부했습니다 (메타 메시지 감지)");
    }

    console.log(`[OpenAI] Summary generated successfully (${summary.length} chars, finish_reason: ${choice?.finish_reason})`);
    return summary.trim();
  } catch (error: any) {
    console.error("[OpenAI] Failed to summarize article:", {
      error: error.message,
      status: error.status,
      code: error.code,
      type: error.type,
    });
    
    // Provide more specific error messages
    if (error.code === "invalid_api_key") {
      throw new Error("OpenAI API 키가 유효하지 않습니다. 키를 확인해주세요.");
    } else if (error.code === "insufficient_quota") {
      throw new Error("OpenAI API 할당량이 부족합니다.");
    } else if (error.status === 404) {
      throw new Error("GPT-5 모델을 찾을 수 없습니다. GPT-4o로 변경을 권장합니다.");
    } else if (error.message) {
      throw new Error(`기사 요약 실패: ${error.message}`);
    } else {
      throw new Error("기사 요약 중 알 수 없는 오류가 발생했습니다.");
    }
  }
}

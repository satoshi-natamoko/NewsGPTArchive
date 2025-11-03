import { storage } from "./storage";
import { db } from "./db";
import { categories, keywords } from "@shared/schema";

// Initial category and keyword data
const initialData = [
  {
    name: "자사뉴스",
    displayOrder: 1,
    keywords: ["그래디언트", "아이마켓코리아", "아이마켓"],
  },
  {
    name: "경쟁사",
    displayOrder: 2,
    keywords: ["KeP", "서브원", "엔투비", "코리아이플랫폼", "행복나래"],
  },
  {
    name: "삼성고객사",
    displayOrder: 3,
    keywords: [
      "삼성SDC", "삼성SDI", "삼성E&A", "삼성디스플레이", "삼성물산",
      "삼성바이오로직스", "삼성바이오에피스", "삼성생명", "삼성에스디아이",
      "삼성에스디에스", "삼성엔지니어링", "삼성이앤에이", "삼성전기",
      "삼성전자", "삼성중공업", "삼성증권", "삼성카드", "삼성화재",
      "에버랜드", "에스원", "웰스토리", "제일기획", "호텔신라"
    ],
  },
  {
    name: "전략고객사",
    displayOrder: 4,
    keywords: [
      "HC컴퍼니", "KPX케미칼", "TKG휴켐스", "YKsteel", "s-tec", "그린케미칼",
      "농심", "대한전선", "대한제강", "대한제당", "디아이지에어가스",
      "롯데칠성", "롯데케미칼", "르노삼성", "르노자동차", "르노코리아",
      "매일유업", "메가마트", "벽산", "세방전지", "스템코", "에스텍시스템",
      "에이치씨컴퍼니", "에코프로", "엘오케이", "와이케이스틸", "우리은행",
      "유신정밀공업", "케이피엑스케미칼", "코스맥스", "코웨이", "태광산업",
      "태양", "티케이지휴켐스", "한국철강", "한라시멘트", "해성디에스",
      "홈플러스", "효성굿스프링스", "효성전기"
    ],
  },
  {
    name: "시황",
    displayOrder: 5,
    keywords: ["PMI", "유가", "환율"],
  },
];

export async function seedDatabase() {
  console.log("Checking if database needs seeding...");

  // Check if categories already exist
  const existingCategories = await storage.getCategories();
  
  if (existingCategories.length > 0) {
    console.log("Database already seeded, skipping...");
    return;
  }

  console.log("Seeding database with initial data...");

  for (const categoryData of initialData) {
    // Create category
    const category = await storage.createCategory({
      name: categoryData.name,
      displayOrder: categoryData.displayOrder,
    });

    console.log(`Created category: ${category.name}`);

    // Add keywords
    await storage.updateKeywordsByCategory(category.id, categoryData.keywords);
    console.log(`  Added ${categoryData.keywords.length} keywords`);
  }

  console.log("Database seeding completed!");
}

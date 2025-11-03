# 뉴스 아카이브 - News Crawler Archive System

## Overview
This application is a news crawling and archiving system that leverages Naver Search API to collect the most representative news articles based on keywords and OpenAI GPT-5 for automatic summarization. The collected news is archived by date for easy retrieval. The system aims to provide a streamlined way for businesses to monitor news related to their company, competitors, clients, and market trends, offering insights through summarized articles, statistical dashboards, and efficient search capabilities.

## User Preferences
- I prefer simple language.
- I want iterative development.
- Ask before making major changes.
- Do not make changes to the folder `Z`.
- Do not make changes to the file `Y`.

## System Architecture

### UI/UX Decisions
The design emphasizes a monochrome, modern aesthetic with a dark mode default, though a light mode is available. Key UI elements include a slide-out management panel with smooth animations, date-based dropdown filters, and a responsive layout for various devices. Typography uses "Inter" for primary text and "JetBrains Mono" for technical data.

### Technical Implementations
- **News Crawling**: Utilizes Naver Search API to fetch articles published within the last 3 days. It selects the single most representative article per keyword using a string similarity analysis. GPT-5 API is used to generate 1-2 sentence summaries. HTML entity decoding and title sanitization (removing brackets and news agency names) are performed.
- **Category System**: Organizes news into five predefined categories: "자사뉴스" (Own Company News), "경쟁사" (Competitors), "삼성고객사" (Samsung Clients), "전략고객사" (Strategic Clients), and "시황" (Market Conditions).
- **Search Functionality**: Supports two modes:
    - **Archive Search**: Searches stored articles by client/keyword with date range and category filtering, displayed in a timeline view.
    - **Real-time Search**: Directly calls Naver Search API for live news within the last month, automatically removing duplicates (70% similarity threshold), sorted by recency.
- **Management Features**: Includes manual crawling initiation with real-time progress display, keyword management (add/edit/delete per category), selective article deletion, date-based archive deletion, bookmarking with personal notes, CSV export, and a statistical dashboard. Automated crawling via a scheduler and notifications (email/Slack) are also supported.
- **Article Replacement**: When auto-selected articles are unsatisfactory, users can manually replace them by viewing alternative articles from the same keyword search. The system stores the keyword used for each article crawl, enabling accurate alternative article retrieval. Selected alternatives are automatically summarized by GPT-5 before replacement.

### System Design Choices
- **Frontend**: Built with React, TypeScript, Wouter for routing, TanStack Query for data fetching, Tailwind CSS with Shadcn UI for styling, and Framer Motion for animations.
- **Backend**: Implemented with Express.js and TypeScript.
- **Database**: PostgreSQL (Neon) with Drizzle ORM.
- **Real-time Updates**: WebSocket is used to track and display real-time crawling progress.

## External Dependencies
- **Naver Search API**: Official API for news article crawling.
- **OpenAI GPT-5 API**: Used for automatic news summarization.
- **PostgreSQL (Neon)**: Database for storing articles, keywords, and system configurations.
- **node-cron**: For scheduling automated crawling tasks.
- **WebSocket**: For real-time communication regarding crawling progress.
- **String Similarity Library**: Used for analyzing and selecting representative articles.
- **Recharts**: For data visualization in the statistics dashboard.
- **date-fns**: For date manipulation and formatting.
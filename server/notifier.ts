import { db } from "./db";
import { notificationSettings, type Article, type Category } from "@shared/schema";
import { eq } from "drizzle-orm";

// Get notification settings (create default if not exists)
export async function getNotificationSettings() {
  const settings = await db.select().from(notificationSettings).limit(1);
  
  if (settings.length === 0) {
    // Create default settings
    const [defaultSettings] = await db.insert(notificationSettings).values({
      enabled: false,
      emailEnabled: false,
      slackEnabled: false,
    }).returning();
    return defaultSettings;
  }
  
  return settings[0];
}

// Update notification settings
export async function updateNotificationSettings(updates: Partial<{
  enabled: boolean;
  emailEnabled: boolean;
  emailAddress: string | null;
  slackEnabled: boolean;
  slackWebhookUrl: string | null;
}>) {
  const existing = await getNotificationSettings();
  
  const [updated] = await db
    .update(notificationSettings)
    .set({
      ...updates,
      updatedAt: new Date(),
    })
    .where(eq(notificationSettings.id, existing.id))
    .returning();
  
  return updated;
}

// Send notification about new articles
export async function sendNotification(articles: Array<Article & { category: Category }>) {
  if (articles.length === 0) {
    return;
  }
  
  const settings = await getNotificationSettings();
  
  if (!settings.enabled) {
    console.log("[Notifier] Notifications disabled, skipping");
    return;
  }
  
  const message = buildNotificationMessage(articles);
  
  // Send email notification
  if (settings.emailEnabled && settings.emailAddress) {
    await sendEmailNotification(settings.emailAddress, message);
  }
  
  // Send Slack notification
  if (settings.slackEnabled && settings.slackWebhookUrl) {
    await sendSlackNotification(settings.slackWebhookUrl, message);
  }
}

// Build notification message
function buildNotificationMessage(articles: Array<Article & { category: Category }>): {
  subject: string;
  text: string;
  html: string;
} {
  const date = new Date().toLocaleDateString('ko-KR');
  const subject = `[뉴스 크롤러] ${articles.length}개의 새 기사가 수집되었습니다 (${date})`;
  
  // Group articles by category
  const articlesByCategory = articles.reduce((acc, article) => {
    const catName = article.category.name;
    if (!acc[catName]) {
      acc[catName] = [];
    }
    acc[catName].push(article);
    return acc;
  }, {} as Record<string, typeof articles>);
  
  // Build text version
  let text = `${subject}\n\n`;
  for (const [catName, catArticles] of Object.entries(articlesByCategory)) {
    text += `━━━ ${catName} (${catArticles.length}개) ━━━\n\n`;
    catArticles.forEach((article, idx) => {
      text += `${idx + 1}. ${article.title}\n`;
      text += `   요약: ${article.summary}\n`;
      text += `   링크: ${article.url}\n\n`;
    });
  }
  
  // Build HTML version
  let html = `
    <div style="font-family: 'Malgun Gothic', 'Apple SD Gothic Neo', sans-serif; max-width: 800px; margin: 0 auto; padding: 20px;">
      <h1 style="color: #1a1a1a; border-bottom: 2px solid #e5e5e5; padding-bottom: 10px;">
        ${subject}
      </h1>
  `;
  
  for (const [catName, catArticles] of Object.entries(articlesByCategory)) {
    html += `
      <div style="margin: 30px 0;">
        <h2 style="color: #333; background: #f5f5f5; padding: 10px; border-left: 4px solid #666;">
          ${catName} (${catArticles.length}개)
        </h2>
    `;
    
    catArticles.forEach((article, idx) => {
      html += `
        <div style="margin: 15px 0; padding: 15px; background: #fafafa; border-radius: 5px;">
          <h3 style="color: #1a1a1a; margin: 0 0 10px 0;">
            ${idx + 1}. ${article.title}
          </h3>
          <p style="color: #666; margin: 5px 0; line-height: 1.6;">
            ${article.summary}
          </p>
          <p style="margin: 10px 0 0 0;">
            <a href="${article.url}" style="color: #0066cc; text-decoration: none;">
              기사 원문 보기 →
            </a>
          </p>
        </div>
      `;
    });
    
    html += `</div>`;
  }
  
  html += `
      <hr style="margin: 30px 0; border: none; border-top: 1px solid #e5e5e5;" />
      <p style="color: #999; font-size: 12px; text-align: center;">
        뉴스 크롤러 자동 알림 | ${new Date().toLocaleString('ko-KR')}
      </p>
    </div>
  `;
  
  return { subject, text, html };
}

// Send email notification
async function sendEmailNotification(emailAddress: string, message: { subject: string; text: string; html: string }) {
  try {
    console.log(`[Notifier] Sending email notification to ${emailAddress}`);
    console.log(`[Notifier] Email functionality requires SMTP configuration`);
    console.log(`[Notifier] Subject: ${message.subject}`);
    
    // Note: Email sending requires SMTP configuration or email service API
    // Users need to configure their own email service (e.g., SendGrid, AWS SES, SMTP)
    // For now, just log the notification
    
    // Example with nodemailer (would need to be installed and configured):
    // const transporter = nodemailer.createTransport({...});
    // await transporter.sendMail({
    //   from: 'noreply@newscrawler.com',
    //   to: emailAddress,
    //   subject: message.subject,
    //   text: message.text,
    //   html: message.html,
    // });
    
    console.log("[Notifier] Email logged (SMTP not configured)");
  } catch (error) {
    console.error("[Notifier] Failed to send email:", error);
  }
}

// Send Slack notification
async function sendSlackNotification(webhookUrl: string, message: { subject: string; text: string }) {
  try {
    console.log(`[Notifier] Sending Slack notification`);
    
    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        text: message.subject,
        blocks: [
          {
            type: "header",
            text: {
              type: "plain_text",
              text: message.subject,
            },
          },
          {
            type: "section",
            text: {
              type: "mrkdwn",
              text: message.text.substring(0, 2900), // Slack has 3000 char limit
            },
          },
        ],
      }),
    });
    
    if (response.ok) {
      console.log("[Notifier] Slack notification sent successfully");
    } else {
      console.error("[Notifier] Slack notification failed:", await response.text());
    }
  } catch (error) {
    console.error("[Notifier] Failed to send Slack notification:", error);
  }
}

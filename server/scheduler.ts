import * as cron from "node-cron";
import { db } from "./db";
import { schedulerSettings } from "@shared/schema";
import { crawlNews } from "./crawler";
import { storage } from "./storage";
import { eq } from "drizzle-orm";

let scheduledTask: cron.ScheduledTask | null = null;

export async function getSchedulerSettings() {
  const settings = await db.select().from(schedulerSettings).limit(1);
  
  if (settings.length === 0) {
    // Create default settings if none exist
    const [newSettings] = await db
      .insert(schedulerSettings)
      .values({
        enabled: false,
        cronExpression: "0 9 * * *", // 9 AM daily
        deleteExisting: false,
      })
      .returning();
    return newSettings;
  }
  
  return settings[0];
}

export async function updateSchedulerSettings(updates: {
  enabled?: boolean;
  cronExpression?: string;
  deleteExisting?: boolean;
}) {
  const current = await getSchedulerSettings();
  
  const [updated] = await db
    .update(schedulerSettings)
    .set({
      ...updates,
      updatedAt: new Date(),
    })
    .where(eq(schedulerSettings.id, current.id))
    .returning();

  // Restart scheduler with new settings
  await initializeScheduler();
  
  return updated;
}

async function runScheduledCrawl() {
  try {
    const settings = await getSchedulerSettings();
    
    console.log(`[Scheduler] Running scheduled crawl at ${new Date().toISOString()}`);
    
    // If deleteExisting is true, delete today's articles first
    if (settings.deleteExisting) {
      const today = new Date().toISOString().split("T")[0];
      await storage.deleteArticlesByDate(today);
      console.log(`[Scheduler] Deleted existing articles for ${today}`);
    }
    
    await crawlNews();
    
    // Update last run time
    await db
      .update(schedulerSettings)
      .set({ lastRun: new Date() })
      .where(eq(schedulerSettings.id, settings.id));
    
    console.log(`[Scheduler] Scheduled crawl completed successfully`);
  } catch (error) {
    console.error(`[Scheduler] Error during scheduled crawl:`, error);
  }
}

export async function initializeScheduler() {
  // Stop existing scheduler if running
  if (scheduledTask) {
    scheduledTask.stop();
    scheduledTask = null;
    console.log("[Scheduler] Stopped previous scheduled task");
  }

  const settings = await getSchedulerSettings();
  
  if (!settings.enabled) {
    console.log("[Scheduler] Scheduler is disabled");
    return;
  }

  // Validate cron expression (this should not happen if API validation works)
  if (!cron.validate(settings.cronExpression)) {
    console.error(`[Scheduler] Invalid cron expression found in database: ${settings.cronExpression}`);
    console.error(`[Scheduler] Scheduler cannot start. Please update the cron expression via API.`);
    // Disable the scheduler in database since it's invalid
    await updateSchedulerSettings({ enabled: false });
    return;
  }

  // Start new scheduler
  try {
    scheduledTask = cron.schedule(settings.cronExpression, runScheduledCrawl, {
      timezone: "Asia/Seoul",
    });
    console.log(`[Scheduler] Scheduler started successfully`);
    console.log(`[Scheduler] Cron expression: ${settings.cronExpression}`);
    console.log(`[Scheduler] Delete existing: ${settings.deleteExisting ? 'Yes' : 'No'}`);
  } catch (error) {
    console.error(`[Scheduler] Failed to start scheduler:`, error);
    throw error;
  }
}

export function stopScheduler() {
  if (scheduledTask) {
    scheduledTask.stop();
    scheduledTask = null;
    console.log("[Scheduler] Scheduler stopped");
  }
}

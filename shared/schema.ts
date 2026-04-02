import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Seasons
export const seasons = sqliteTable("seasons", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  seasonNumber: integer("season_number").notNull(),
  startDate: text("start_date").notNull(), // YYYY-MM-DD
  status: text("status").notNull().default("registration"), // registration | active | tiebreaker | completed
  stockList: text("stock_list").notNull().default("[]"), // JSON array of { code, name, sequence }
  winnerId: integer("winner_id"),
  winnerName: text("winner_name"),
  prizeName: text("prize_name").default("Prize Pack"),
  sponsorName: text("sponsor_name"),
  sponsorLogo: text("sponsor_logo"),
  sponsorColor: text("sponsor_color").default("#00843D"),
  sponsorAccent: text("sponsor_accent").default("#FFD700"),
  sponsorTagline: text("sponsor_tagline"),
  sponsorCtaUrl: text("sponsor_cta_url"),
  sponsorCtaText: text("sponsor_cta_text"),
  currentDay: integer("current_day").notNull().default(0),
  tiebreakerType: text("tiebreaker_type"), // null | 'A' | 'B'
  maxDays: integer("max_days").notNull().default(20),
});

// Players
export const players = sqliteTable("players", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  displayName: text("display_name").notNull(),
  mobile: text("mobile").notNull(),
  seasonId: integer("season_id").notNull(),
  status: text("status").notNull().default("alive"), // alive | eliminated
  eliminatedDay: integer("eliminated_day"),
  sessionToken: text("session_token"),
});

// Daily picks
export const picks = sqliteTable("picks", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  playerId: integer("player_id").notNull(),
  seasonId: integer("season_id").notNull(),
  day: integer("day").notNull(),
  stockCode: text("stock_code").notNull(),
  stockName: text("stock_name").notNull(),
  direction: text("direction").notNull(), // up | down
  isAuto: integer("is_auto").notNull().default(0), // 0 or 1
  closingPercent: text("closing_percent"), // stored after results
  result: text("result"), // survived | eliminated | pending
  lockedAt: text("locked_at"),
});

// Admin users
export const admins = sqliteTable("admins", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
});

// Schemas
export const insertSeasonSchema = createInsertSchema(seasons).omit({ id: true });
export const insertPlayerSchema = createInsertSchema(players).omit({ id: true });
export const insertPickSchema = createInsertSchema(picks).omit({ id: true });
export const insertAdminSchema = createInsertSchema(admins).omit({ id: true });

// Types
export type Season = typeof seasons.$inferSelect;
export type InsertSeason = z.infer<typeof insertSeasonSchema>;
export type Player = typeof players.$inferSelect;
export type InsertPlayer = z.infer<typeof insertPlayerSchema>;
export type Pick = typeof picks.$inferSelect;
export type InsertPick = z.infer<typeof insertPickSchema>;
export type Admin = typeof admins.$inferSelect;
export type InsertAdmin = z.infer<typeof insertAdminSchema>;

// Stock type used in stockList JSON
export interface Stock {
  code: string;
  name: string;
  sequence: number;
}

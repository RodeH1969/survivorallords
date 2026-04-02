import {
  seasons,
  players,
  picks,
  admins,
  type Season,
  type InsertSeason,
  type Player,
  type InsertPlayer,
  type Pick,
  type InsertPick,
  type Admin,
  type InsertAdmin,
} from "@shared/schema";
import { drizzle } from "drizzle-orm/better-sqlite3";
import Database from "better-sqlite3";
import { eq, and } from "drizzle-orm";
import { sql } from "drizzle-orm";

import path from "path";
import fs from "fs";

// Use /opt/render/project/data on Render (persistent disk), otherwise local
const dataDir = process.env.RENDER ? "/opt/render/project/data" : ".";
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
const sqlite = new Database(path.join(dataDir, "data.db"));
sqlite.pragma("journal_mode = WAL");

export const db = drizzle(sqlite);

// ── Auto-migrations ──────────────────────────────────────────────────────────

db.run(sql`
  CREATE TABLE IF NOT EXISTS seasons (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    season_number INTEGER NOT NULL,
    start_date TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'registration',
    stock_list TEXT NOT NULL DEFAULT '[]',
    winner_id INTEGER,
    winner_name TEXT,
    prize_name TEXT DEFAULT 'Prize Pack',
    sponsor_name TEXT,
    sponsor_logo TEXT,
    sponsor_color TEXT DEFAULT '#00843D',
    sponsor_accent TEXT DEFAULT '#FFD700',
    sponsor_tagline TEXT,
    sponsor_cta_url TEXT,
    sponsor_cta_text TEXT,
    current_day INTEGER NOT NULL DEFAULT 0,
    tiebreaker_type TEXT,
    max_days INTEGER NOT NULL DEFAULT 20
  )
`);

// Migrations for existing databases
try { db.run(sql`ALTER TABLE seasons ADD COLUMN winner_name TEXT`); } catch {}
try { db.run(sql`ALTER TABLE seasons ADD COLUMN tiebreaker_type TEXT`); } catch {}
try { db.run(sql`ALTER TABLE seasons ADD COLUMN max_days INTEGER NOT NULL DEFAULT 20`); } catch {}

db.run(sql`
  CREATE TABLE IF NOT EXISTS players (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    display_name TEXT NOT NULL,
    mobile TEXT NOT NULL,
    season_id INTEGER NOT NULL,
    status TEXT NOT NULL DEFAULT 'alive',
    eliminated_day INTEGER,
    session_token TEXT
  )
`);

db.run(sql`
  CREATE TABLE IF NOT EXISTS picks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    player_id INTEGER NOT NULL,
    season_id INTEGER NOT NULL,
    day INTEGER NOT NULL,
    stock_code TEXT NOT NULL,
    stock_name TEXT NOT NULL,
    direction TEXT NOT NULL,
    is_auto INTEGER NOT NULL DEFAULT 0,
    closing_percent TEXT,
    result TEXT,
    locked_at TEXT
  )
`);

db.run(sql`
  CREATE TABLE IF NOT EXISTS admins (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT NOT NULL UNIQUE,
    password TEXT NOT NULL
  )
`);

// ── Storage Interface ────────────────────────────────────────────────────────

export interface IStorage {
  // Season
  getActiveSeason(): Promise<Season | undefined>;
  getSeasonById(id: number): Promise<Season | undefined>;
  createSeason(season: InsertSeason): Promise<Season>;
  updateSeason(id: number, updates: Partial<Season>): Promise<Season | undefined>;
  getAllSeasons(): Promise<Season[]>;

  // Player
  createPlayer(player: InsertPlayer): Promise<Player>;
  getPlayerByMobile(mobile: string, seasonId: number): Promise<Player | undefined>;
  getPlayerByToken(token: string): Promise<Player | undefined>;
  getPlayersBySeasonId(seasonId: number): Promise<Player[]>;
  updatePlayer(id: number, updates: Partial<Player>): Promise<Player | undefined>;

  // Pick
  createPick(pick: InsertPick): Promise<Pick>;
  getPicksByPlayerAndSeason(playerId: number, seasonId: number): Promise<Pick[]>;
  getPicksByDay(seasonId: number, day: number): Promise<Pick[]>;
  updatePick(id: number, updates: Partial<Pick>): Promise<Pick | undefined>;
  getPickByPlayerAndDay(playerId: number, seasonId: number, day: number): Promise<Pick | undefined>;

  // Admin
  getAdminByUsername(username: string): Promise<Admin | undefined>;
  createAdmin(admin: InsertAdmin): Promise<Admin>;

  // Reset
  resetAllGameData(): Promise<void>;
}

// ── DatabaseStorage Implementation ───────────────────────────────────────────

export class DatabaseStorage implements IStorage {
  // ── Season ──────────────────────────────────────────────────────────────

  async getActiveSeason(): Promise<Season | undefined> {
    return db
      .select()
      .from(seasons)
      .where(eq(seasons.status, "active"))
      .get() ??
      db.select().from(seasons).where(eq(seasons.status, "tiebreaker")).get() ??
      // fall back to registration status if no active season
      db.select().from(seasons).where(eq(seasons.status, "registration")).get();
  }

  async getSeasonById(id: number): Promise<Season | undefined> {
    return db.select().from(seasons).where(eq(seasons.id, id)).get();
  }

  async createSeason(season: InsertSeason): Promise<Season> {
    return db.insert(seasons).values(season).returning().get();
  }

  async updateSeason(id: number, updates: Partial<Season>): Promise<Season | undefined> {
    const result = db
      .update(seasons)
      .set(updates)
      .where(eq(seasons.id, id))
      .returning()
      .get();
    return result;
  }

  async getAllSeasons(): Promise<Season[]> {
    return db.select().from(seasons).all();
  }

  // ── Player ───────────────────────────────────────────────────────────────

  async createPlayer(player: InsertPlayer): Promise<Player> {
    return db.insert(players).values(player).returning().get();
  }

  async getPlayerByMobile(mobile: string, seasonId: number): Promise<Player | undefined> {
    return db
      .select()
      .from(players)
      .where(and(eq(players.mobile, mobile), eq(players.seasonId, seasonId)))
      .get();
  }

  async getPlayerByToken(token: string): Promise<Player | undefined> {
    return db
      .select()
      .from(players)
      .where(eq(players.sessionToken, token))
      .get();
  }

  async getPlayersBySeasonId(seasonId: number): Promise<Player[]> {
    return db
      .select()
      .from(players)
      .where(eq(players.seasonId, seasonId))
      .all();
  }

  async updatePlayer(id: number, updates: Partial<Player>): Promise<Player | undefined> {
    return db
      .update(players)
      .set(updates)
      .where(eq(players.id, id))
      .returning()
      .get();
  }

  // ── Pick ─────────────────────────────────────────────────────────────────

  async createPick(pick: InsertPick): Promise<Pick> {
    return db.insert(picks).values(pick).returning().get();
  }

  async getPicksByPlayerAndSeason(playerId: number, seasonId: number): Promise<Pick[]> {
    return db
      .select()
      .from(picks)
      .where(and(eq(picks.playerId, playerId), eq(picks.seasonId, seasonId)))
      .all();
  }

  async getPicksByDay(seasonId: number, day: number): Promise<Pick[]> {
    return db
      .select()
      .from(picks)
      .where(and(eq(picks.seasonId, seasonId), eq(picks.day, day)))
      .all();
  }

  async updatePick(id: number, updates: Partial<Pick>): Promise<Pick | undefined> {
    return db
      .update(picks)
      .set(updates)
      .where(eq(picks.id, id))
      .returning()
      .get();
  }

  async getPickByPlayerAndDay(
    playerId: number,
    seasonId: number,
    day: number
  ): Promise<Pick | undefined> {
    return db
      .select()
      .from(picks)
      .where(
        and(
          eq(picks.playerId, playerId),
          eq(picks.seasonId, seasonId),
          eq(picks.day, day)
        )
      )
      .get();
  }

  // ── Admin ─────────────────────────────────────────────────────────────────

  async getAdminByUsername(username: string): Promise<Admin | undefined> {
    return db
      .select()
      .from(admins)
      .where(eq(admins.username, username))
      .get();
  }

  async createAdmin(admin: InsertAdmin): Promise<Admin> {
    return db.insert(admins).values(admin).returning().get();
  }

  async resetAllGameData(): Promise<void> {
    db.run(sql`DELETE FROM picks`);
    db.run(sql`DELETE FROM players`);
    db.run(sql`DELETE FROM seasons`);
  }
}

export const storage = new DatabaseStorage();

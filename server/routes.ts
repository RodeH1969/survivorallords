import type { Express, Request, Response, NextFunction } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import type { Player, Season, Stock } from "@shared/schema";
import crypto from "crypto";

// ── Constants ────────────────────────────────────────────────────────────────

const MAX_SEASON_DAYS = 20;

// ── Helpers ──────────────────────────────────────────────────────────────────

/** Get current AEST hour (UTC+10). */
function aestHour(): number {
  const now = new Date();
  const utcMs = now.getTime() + now.getTimezoneOffset() * 60_000;
  const aestMs = utcMs + 10 * 60 * 60 * 1000;
  return new Date(aestMs).getHours();
}

/**
 * Is the pick window open?
 * Production: 7am–10am AEST.
 * TODO: Re-enable for production deployment to Render.
 */
function isPickWindowOpen(): boolean {
  // Demo/testing mode: always open
  return true;
  // Production guard (enable for Render deployment):
  // const h = aestHour();
  // return h >= 7 && h < 10;
}

/** Parse the stockList JSON from a season. */
function parseStockList(season: Season): Stock[] {
  try {
    return JSON.parse(season.stockList) as Stock[];
  } catch {
    return [];
  }
}

/**
 * Core results processing logic.
 * Used by admin/auto-results, admin/process-results, and cron/process-daily.
 * Handles: elimination logic, tiebreaker detection (A & B), season completion,
 * day advancement, and 20-day season limit.
 */
async function processResultsCore(
  season: Season,
  priceMap: Map<string, number>
): Promise<{
  day: number;
  summary: Array<{
    pickId: number;
    playerId: number;
    playerName?: string;
    stockCode: string;
    direction: string;
    closingPercent: number;
    result: "survived" | "eliminated" | "tiebreaker_win" | "tiebreaker_lose" | "tiebreaker_draw";
  }>;
  casualties: number[];
  survivorsRemaining: number;
  nextDay: number | null;
  seasonCompleted: boolean;
  winnerName?: string;
  tiebreakerTriggered?: string;
}> {
  const dayPicks = await storage.getPicksByDay(season.id, season.currentDay);
  const allPlayers = await storage.getPlayersBySeasonId(season.id);
  const playerMap = new Map(allPlayers.map((p) => [p.id, p]));

  const isTiebreakerMode = season.status === "tiebreaker";

  const summary: Array<{
    pickId: number;
    playerId: number;
    playerName?: string;
    stockCode: string;
    direction: string;
    closingPercent: number;
    result: "survived" | "eliminated" | "tiebreaker_win" | "tiebreaker_lose" | "tiebreaker_draw";
  }> = [];
  const casualties: number[] = [];

  if (isTiebreakerMode) {
    // ── TIEBREAKER RESOLUTION ────────────────────────────────────────────
    // In tiebreaker, we compare absolute % movement. Highest wins.
    // Direction doesn't matter for survival — only absolute movement.

    const pickResults: Array<{
      pick: typeof dayPicks[0];
      player: Player;
      absMovement: number;
      closingPercent: number;
    }> = [];

    for (const pick of dayPicks) {
      const cp = priceMap.get(pick.stockCode) ?? 0;
      const absMovement = Math.abs(cp);
      const player = playerMap.get(pick.playerId);
      if (!player) continue;

      await storage.updatePick(pick.id, {
        closingPercent: cp.toString(),
        result: "survived", // temporarily — will update below
      });

      pickResults.push({ pick, player, absMovement, closingPercent: cp });
    }

    // Sort by absolute movement descending
    pickResults.sort((a, b) => b.absMovement - a.absMovement);

    if (pickResults.length >= 2) {
      const best = pickResults[0].absMovement;
      const secondBest = pickResults[1].absMovement;

      if (best === secondBest) {
        // DRAW — tiebreaker replays next trading day
        for (const pr of pickResults) {
          await storage.updatePick(pr.pick.id, { result: "survived" });
          summary.push({
            pickId: pr.pick.id,
            playerId: pr.pick.playerId,
            playerName: pr.player.displayName,
            stockCode: pr.pick.stockCode,
            direction: pr.pick.direction,
            closingPercent: pr.closingPercent,
            result: "tiebreaker_draw",
          });
        }

        // Advance day for next tiebreaker attempt
        await storage.updateSeason(season.id, { currentDay: season.currentDay + 1 });

        const alivePlayers = allPlayers.filter((p) => p.status === "alive");
        return {
          day: season.currentDay,
          summary,
          casualties: [],
          survivorsRemaining: alivePlayers.length,
          nextDay: season.currentDay + 1,
          seasonCompleted: false,
          tiebreakerTriggered: "draw_replay",
        };
      } else {
        // We have a clear winner (highest absolute movement)
        const winner = pickResults[0];
        const losers = pickResults.slice(1);

        await storage.updatePick(winner.pick.id, { result: "survived" });
        summary.push({
          pickId: winner.pick.id,
          playerId: winner.pick.playerId,
          playerName: winner.player.displayName,
          stockCode: winner.pick.stockCode,
          direction: winner.pick.direction,
          closingPercent: winner.closingPercent,
          result: "tiebreaker_win",
        });

        for (const loser of losers) {
          await storage.updatePick(loser.pick.id, { result: "eliminated" });
          await storage.updatePlayer(loser.pick.playerId, {
            status: "eliminated",
            eliminatedDay: season.currentDay,
          });
          casualties.push(loser.pick.playerId);
          summary.push({
            pickId: loser.pick.id,
            playerId: loser.pick.playerId,
            playerName: loser.player.displayName,
            stockCode: loser.pick.stockCode,
            direction: loser.pick.direction,
            closingPercent: loser.closingPercent,
            result: "tiebreaker_lose",
          });
        }

        // Crown winner
        await storage.updateSeason(season.id, {
          status: "completed",
          winnerId: winner.player.id,
          winnerName: winner.player.displayName,
        });

        return {
          day: season.currentDay,
          summary,
          casualties,
          survivorsRemaining: 1,
          nextDay: null,
          seasonCompleted: true,
          winnerName: winner.player.displayName,
        };
      }
    }

    // Fallback: only 1 player in tiebreaker (shouldn't happen)
    if (pickResults.length === 1) {
      await storage.updateSeason(season.id, {
        status: "completed",
        winnerId: pickResults[0].player.id,
        winnerName: pickResults[0].player.displayName,
      });
      summary.push({
        pickId: pickResults[0].pick.id,
        playerId: pickResults[0].pick.playerId,
        playerName: pickResults[0].player.displayName,
        stockCode: pickResults[0].pick.stockCode,
        direction: pickResults[0].pick.direction,
        closingPercent: pickResults[0].closingPercent,
        result: "tiebreaker_win",
      });
      return {
        day: season.currentDay,
        summary,
        casualties: [],
        survivorsRemaining: 1,
        nextDay: null,
        seasonCompleted: true,
        winnerName: pickResults[0].player.displayName,
      };
    }

    return {
      day: season.currentDay,
      summary,
      casualties: [],
      survivorsRemaining: 0,
      nextDay: null,
      seasonCompleted: true,
    };
  }

  // ── NORMAL MODE RESULTS ──────────────────────────────────────────────────
  for (const pick of dayPicks) {
    const cp = priceMap.get(pick.stockCode) ?? 0;

    // Rule 5: UP survives only if cp > 0. DOWN survives only if cp < 0.
    // Flat (0), suspended, or data unavailable = elimination for everyone.
    let result: "survived" | "eliminated";
    if (pick.direction === "up") {
      result = cp > 0 ? "survived" : "eliminated";
    } else {
      result = cp < 0 ? "survived" : "eliminated";
    }

    await storage.updatePick(pick.id, {
      closingPercent: cp.toString(),
      result,
    });

    if (result === "eliminated") {
      casualties.push(pick.playerId);
      await storage.updatePlayer(pick.playerId, {
        status: "eliminated",
        eliminatedDay: season.currentDay,
      });
    }

    const player = playerMap.get(pick.playerId);
    summary.push({
      pickId: pick.id,
      playerId: pick.playerId,
      playerName: player?.displayName,
      stockCode: pick.stockCode,
      direction: pick.direction,
      closingPercent: cp,
      result,
    });
  }

  // ── POST-RESULTS: Check end conditions ──────────────────────────────────

  // Re-fetch alive players after processing
  const updatedPlayers = await storage.getPlayersBySeasonId(season.id);
  const alivePlayers = updatedPlayers.filter((p) => p.status === "alive");
  const stockList = parseStockList(season);
  const maxDays = season.maxDays ?? MAX_SEASON_DAYS;

  // Rule 5: All eliminated same day = no winner
  if (alivePlayers.length === 0) {
    await storage.updateSeason(season.id, { status: "completed" });
    return {
      day: season.currentDay,
      summary,
      casualties,
      survivorsRemaining: 0,
      nextDay: null,
      seasonCompleted: true,
    };
  }

  // Rule 7: Last player standing = winner
  if (alivePlayers.length === 1) {
    await storage.updateSeason(season.id, {
      status: "completed",
      winnerId: alivePlayers[0].id,
      winnerName: alivePlayers[0].displayName,
    });
    return {
      day: season.currentDay,
      summary,
      casualties,
      survivorsRemaining: 1,
      nextDay: null,
      seasonCompleted: true,
      winnerName: alivePlayers[0].displayName,
    };
  }

  // Rule 8 (Tiebreaker A): Exactly 2 players remain alive before all picks exhausted.
  // Only trigger when someone was just eliminated this round (casualties > 0),
  // narrowing the field down to 2.
  if (alivePlayers.length === 2 && casualties.length > 0 && season.currentDay < maxDays) {
    await storage.updateSeason(season.id, {
      status: "tiebreaker",
      tiebreakerType: "A",
      currentDay: season.currentDay + 1,
    });
    return {
      day: season.currentDay,
      summary,
      casualties,
      survivorsRemaining: 2,
      nextDay: season.currentDay + 1,
      seasonCompleted: false,
      tiebreakerTriggered: "A",
    };
  }

  // Rule 9 (Tiebreaker B): All 20 picks exhausted (we're on the last day) and 2+ alive
  if (season.currentDay >= maxDays && alivePlayers.length >= 2) {
    await storage.updateSeason(season.id, {
      status: "tiebreaker",
      tiebreakerType: "B",
      currentDay: season.currentDay + 1,
    });
    return {
      day: season.currentDay,
      summary,
      casualties,
      survivorsRemaining: alivePlayers.length,
      nextDay: season.currentDay + 1,
      seasonCompleted: false,
      tiebreakerTriggered: "B",
    };
  }

  // Normal: advance to next day
  await storage.updateSeason(season.id, { currentDay: season.currentDay + 1 });

  return {
    day: season.currentDay,
    summary,
    casualties,
    survivorsRemaining: alivePlayers.length,
    nextDay: season.currentDay + 1,
    seasonCompleted: false,
  };
}

/**
 * Fetch real closing prices from Yahoo Finance for given ASX stock codes.
 */
async function fetchYahooPrices(stockCodes: string[]): Promise<Map<string, number>> {
  const priceMap = new Map<string, number>();
  for (const code of stockCodes) {
    try {
      const yahooSymbol = `${code}.AX`;
      const url = `https://query1.finance.yahoo.com/v8/finance/chart/${yahooSymbol}?interval=1d&range=2d`;
      const resp = await fetch(url, {
        headers: { "User-Agent": "Mozilla/5.0" },
      });
      const data = (await resp.json()) as any;
      const result = data?.chart?.result?.[0];
      if (!result) continue;

      const closes = result.indicators?.quote?.[0]?.close as number[] | undefined;
      const meta = result.meta;
      const prevClose = meta?.chartPreviousClose ?? (closes && closes.length > 0 ? closes[0] : null);
      const latestClose = meta?.regularMarketPrice ?? (closes ? closes.filter((c: any) => c != null).pop() : null);

      if (prevClose && latestClose && prevClose > 0) {
        const pctChange = ((latestClose - prevClose) / prevClose) * 100;
        priceMap.set(code, Math.round(pctChange * 100) / 100);
      }
    } catch (err) {
      console.error(`Failed to fetch price for ${code}:`, err);
    }
  }
  return priceMap;
}

/**
 * Auto-assign picks for alive players who haven't picked today.
 * For tiebreaker B, assigns their Day 1 stock.
 * For normal/tiebreaker A, assigns lowest-sequence unused stock as DOWN.
 */
async function autoAssignPicks(season: Season): Promise<Array<{ playerId: number; stockCode: string }>> {
  const stockList = parseStockList(season);
  const sortedStocks = [...stockList].sort((a, b) => a.sequence - b.sequence);
  const allPlayers = await storage.getPlayersBySeasonId(season.id);
  const alive = allPlayers.filter((p) => p.status === "alive");
  const assigned: Array<{ playerId: number; stockCode: string }> = [];

  for (const player of alive) {
    const existingPick = await storage.getPickByPlayerAndDay(player.id, season.id, season.currentDay);
    if (existingPick) continue;

    if (season.status === "tiebreaker" && season.tiebreakerType === "B") {
      // Tiebreaker B: Use Day 1 stock
      const day1Pick = await storage.getPickByPlayerAndDay(player.id, season.id, 1);
      if (!day1Pick) continue;

      await storage.createPick({
        playerId: player.id,
        seasonId: season.id,
        day: season.currentDay,
        stockCode: day1Pick.stockCode,
        stockName: day1Pick.stockName,
        direction: day1Pick.direction,
        isAuto: 1,
        lockedAt: new Date().toISOString(),
      });
      assigned.push({ playerId: player.id, stockCode: day1Pick.stockCode });
    } else {
      // Normal or Tiebreaker A: lowest-sequence unused stock, DOWN
      const playerPicks = await storage.getPicksByPlayerAndSeason(player.id, season.id);
      const usedCodes = new Set(playerPicks.map((p) => p.stockCode));
      const stock = sortedStocks.find((s) => !usedCodes.has(s.code));
      if (!stock) continue;

      await storage.createPick({
        playerId: player.id,
        seasonId: season.id,
        day: season.currentDay,
        stockCode: stock.code,
        stockName: stock.name,
        direction: "down",
        isAuto: 1,
        lockedAt: new Date().toISOString(),
      });
      assigned.push({ playerId: player.id, stockCode: stock.code });
    }
  }

  return assigned;
}

// ── Auth middleware ───────────────────────────────────────────────────────────

async function requireAuth(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  const token = req.headers["x-session-token"] as string | undefined;
  if (!token) {
    res.status(401).json({ message: "Missing x-session-token header" });
    return;
  }
  const player = await storage.getPlayerByToken(token);
  if (!player) {
    res.status(401).json({ message: "Invalid or expired session token" });
    return;
  }
  (req as any).player = player;
  next();
}

async function requireAdmin(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  const token = req.headers["x-session-token"] as string | undefined;
  if (!token) {
    res.status(401).json({ message: "Missing x-session-token header" });
    return;
  }
  const username = adminSessions.get(token);
  if (!username) {
    res.status(401).json({ message: "Invalid admin session" });
    return;
  }
  (req as any).adminUsername = username;
  next();
}

// In-memory admin session map (token → username).
const adminSessions = new Map<string, string>();

// ── Route registration ────────────────────────────────────────────────────────

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {

  // ── Auth ────────────────────────────────────────────────────────────────

  /** POST /api/register */
  app.post("/api/register", async (req: Request, res: Response): Promise<void> => {
    const { displayName, mobile } = req.body as { displayName?: string; mobile?: string };

    if (!displayName || !mobile) {
      res.status(400).json({ message: "displayName and mobile are required" });
      return;
    }

    const season = await storage.getActiveSeason();
    if (!season) {
      res.status(400).json({ message: "No active or registration season found" });
      return;
    }

    // Rule 2: No mid-season registration. Only allow during "registration" status.
    if (season.status !== "registration") {
      res.status(403).json({ message: "Registration is closed. No mid-season entries are permitted." });
      return;
    }

    // Reject if mobile already exists for this season
    const existing = await storage.getPlayerByMobile(mobile, season.id);
    if (existing) {
      res.status(409).json({ message: "Mobile number already registered for this season" });
      return;
    }

    const sessionToken = crypto.randomUUID();

    const player = await storage.createPlayer({
      displayName,
      mobile,
      seasonId: season.id,
      status: "alive",
      sessionToken,
    });

    res.status(201).json({ playerId: player.id, sessionToken });
  });

  /** POST /api/login */
  app.post("/api/login", async (req: Request, res: Response): Promise<void> => {
    const { mobile } = req.body as { mobile?: string };

    if (!mobile) {
      res.status(400).json({ message: "mobile is required" });
      return;
    }

    const season = await storage.getActiveSeason();
    if (!season) {
      res.status(400).json({ message: "No active season found" });
      return;
    }

    const player = await storage.getPlayerByMobile(mobile, season.id);
    if (!player) {
      res.status(404).json({ message: "Player not found for this season" });
      return;
    }

    // Rotate session token on login
    const sessionToken = crypto.randomUUID();
    const updated = await storage.updatePlayer(player.id, { sessionToken });

    res.json({ playerId: player.id, sessionToken });
  });

  /** GET /api/me */
  app.get("/api/me", requireAuth, async (req: Request, res: Response): Promise<void> => {
    const player = (req as any).player as Player;

    const season = await storage.getSeasonById(player.seasonId);
    if (!season) {
      res.status(500).json({ message: "Season not found" });
      return;
    }

    // Today's pick
    const todayPick =
      season.currentDay > 0
        ? await storage.getPickByPlayerAndDay(player.id, season.id, season.currentDay)
        : undefined;

    // Used stocks (all picks across the season for this player)
    const allPicks = await storage.getPicksByPlayerAndSeason(player.id, season.id);
    const usedStocks = allPicks.map((p) => p.stockCode);

    res.json({
      player,
      season,
      todayPick: todayPick ?? null,
      usedStocks,
    });
  });

  // ── Game ────────────────────────────────────────────────────────────────

  /** POST /api/pick */
  app.post("/api/pick", requireAuth, async (req: Request, res: Response): Promise<void> => {
    const player = (req as any).player as Player;

    if (player.status === "eliminated") {
      res.status(403).json({ message: "You have been eliminated" });
      return;
    }

    const { stockCode, stockName, direction } = req.body as {
      stockCode?: string;
      stockName?: string;
      direction?: string;
    };

    if (!stockCode || !stockName || !direction) {
      res.status(400).json({ message: "stockCode, stockName, and direction are required" });
      return;
    }

    if (direction !== "up" && direction !== "down") {
      res.status(400).json({ message: "direction must be 'up' or 'down'" });
      return;
    }

    if (!isPickWindowOpen()) {
      res.status(403).json({ message: "Pick window is closed. Picks are open 7am–10am AEST." });
      return;
    }

    const season = await storage.getSeasonById(player.seasonId);
    if (!season || (season.status !== "active" && season.status !== "tiebreaker")) {
      res.status(400).json({ message: "Season is not active" });
      return;
    }

    if (season.currentDay === 0) {
      res.status(400).json({ message: "Season has not started yet" });
      return;
    }

    // Tiebreaker B: Players must use their Day 1 stock — no free pick
    if (season.status === "tiebreaker" && season.tiebreakerType === "B") {
      const day1Pick = await storage.getPickByPlayerAndDay(player.id, season.id, 1);
      if (!day1Pick || day1Pick.stockCode !== stockCode) {
        res.status(400).json({
          message: `Tiebreaker B: You must use your Day 1 stock (${day1Pick?.stockCode ?? "unknown"}).`,
        });
        return;
      }
    }

    // Validate stock is in the season's stock list
    const stockList = parseStockList(season);
    const stockEntry = stockList.find((s) => s.code === stockCode);
    if (!stockEntry) {
      res.status(400).json({ message: `Stock ${stockCode} is not in this season's stock list` });
      return;
    }

    // Check stock hasn't been used already (skip for tiebreaker modes — stocks can be reused)
    if (season.status === "active") {
      const allPicks = await storage.getPicksByPlayerAndSeason(player.id, season.id);
      const usedCodes = allPicks
        .filter((p) => p.day !== season.currentDay) // allow updating today's pick
        .map((p) => p.stockCode);

      if (usedCodes.includes(stockCode)) {
        res.status(409).json({ message: `Stock ${stockCode} has already been used this season` });
        return;
      }
    }

    // Check if there is already a pick for today
    const existingPick = await storage.getPickByPlayerAndDay(
      player.id,
      season.id,
      season.currentDay
    );

    const lockedAt = new Date().toISOString();

    let pick;
    if (existingPick) {
      pick = await storage.updatePick(existingPick.id, {
        stockCode,
        stockName,
        direction,
        isAuto: 0,
        lockedAt,
        result: null,
        closingPercent: null,
      });
    } else {
      pick = await storage.createPick({
        playerId: player.id,
        seasonId: season.id,
        day: season.currentDay,
        stockCode,
        stockName,
        direction,
        isAuto: 0,
        lockedAt,
      });
    }

    res.json({ pick });
  });

  /** GET /api/picks/:day */
  app.get("/api/picks/:day", async (req: Request, res: Response): Promise<void> => {
    const day = parseInt(req.params["day"] as string, 10);
    if (isNaN(day)) {
      res.status(400).json({ message: "Invalid day parameter" });
      return;
    }

    const season = await storage.getActiveSeason();
    if (!season) {
      res.status(404).json({ message: "No active season" });
      return;
    }

    // Only show picks after 10am AEST lock (or if requesting a past day)
    const isPastDay = day < season.currentDay;
    const isAfterLock = aestHour() >= 10;

    if (!isPastDay && !isAfterLock) {
      res.status(403).json({ message: "Picks are locked until 10am AEST" });
      return;
    }

    const dayPicks = await storage.getPicksByDay(season.id, day);
    const allPlayers = await storage.getPlayersBySeasonId(season.id);
    const playerMap = new Map(allPlayers.map((p) => [p.id, p]));

    const picksWithPlayers = dayPicks.map((pick) => ({
      ...pick,
      playerName: playerMap.get(pick.playerId)?.displayName ?? "Unknown",
      playerStatus: playerMap.get(pick.playerId)?.status ?? "unknown",
    }));

    res.json({ day, picks: picksWithPlayers });
  });

  /** GET /api/results/:day */
  app.get("/api/results/:day", async (req: Request, res: Response): Promise<void> => {
    const day = parseInt(req.params["day"] as string, 10);
    if (isNaN(day)) {
      res.status(400).json({ message: "Invalid day parameter" });
      return;
    }

    const season = await storage.getActiveSeason();
    if (!season) {
      // Try to find the most recent completed season
      const allSeasons = await storage.getAllSeasons();
      const completed = allSeasons.filter((s) => s.status === "completed");
      if (completed.length === 0) {
        res.status(404).json({ message: "No season found" });
        return;
      }
      // Use the latest completed season
      const latestSeason = completed[completed.length - 1];
      const dayPicks = await storage.getPicksByDay(latestSeason.id, day);
      const allPlayers = await storage.getPlayersBySeasonId(latestSeason.id);
      const playerMap = new Map(allPlayers.map((p) => [p.id, p]));

      const results = dayPicks.map((pick) => ({
        pick,
        player: playerMap.get(pick.playerId),
      }));

      const casualties = dayPicks
        .filter((p) => p.result === "eliminated")
        .map((p) => playerMap.get(p.playerId))
        .filter(Boolean);

      res.json({ day, results, casualties });
      return;
    }

    const dayPicks = await storage.getPicksByDay(season.id, day);
    const allPlayers = await storage.getPlayersBySeasonId(season.id);

    const playerMap = new Map(allPlayers.map((p) => [p.id, p]));

    const results = dayPicks.map((pick) => ({
      pick,
      player: playerMap.get(pick.playerId),
    }));

    const casualties = dayPicks
      .filter((p) => p.result === "eliminated")
      .map((p) => playerMap.get(p.playerId))
      .filter(Boolean);

    res.json({ day, results, casualties });
  });

  /** GET /api/leaderboard */
  app.get("/api/leaderboard", async (_req: Request, res: Response): Promise<void> => {
    const season = await storage.getActiveSeason();
    if (!season) {
      // Try completed season
      const allSeasons = await storage.getAllSeasons();
      const completed = allSeasons.filter((s) => s.status === "completed");
      if (completed.length > 0) {
        const latestSeason = completed[completed.length - 1];
        const allPlayers = await storage.getPlayersBySeasonId(latestSeason.id);
        const leaderboard = await Promise.all(
          allPlayers.map(async (player) => {
            const playerPicks = await storage.getPicksByPlayerAndSeason(player.id, latestSeason.id);
            const daysSurvived = player.status === "eliminated"
              ? (player.eliminatedDay ?? 1) - 1
              : latestSeason.currentDay;
            return { player, daysSurvived, picksRemaining: 0 };
          })
        );
        leaderboard.sort((a, b) => {
          if (a.player.status === b.player.status) return b.daysSurvived - a.daysSurvived;
          return a.player.status === "alive" ? -1 : 1;
        });
        res.json({ season: latestSeason, leaderboard });
        return;
      }
      res.status(404).json({ message: "No active season" });
      return;
    }

    const allPlayers = await storage.getPlayersBySeasonId(season.id);

    const leaderboard = await Promise.all(
      allPlayers.map(async (player) => {
        const playerPicks = await storage.getPicksByPlayerAndSeason(player.id, season.id);
        const daysSurvived =
          player.status === "eliminated"
            ? (player.eliminatedDay ?? 1) - 1
            : season.currentDay;
        const picksRemaining =
          parseStockList(season).length - playerPicks.length;
        return {
          player,
          daysSurvived,
          picksRemaining,
        };
      })
    );

    // Sort: alive players first, then by days survived desc
    leaderboard.sort((a, b) => {
      if (a.player.status === b.player.status) {
        return b.daysSurvived - a.daysSurvived;
      }
      return a.player.status === "alive" ? -1 : 1;
    });

    res.json({ season, leaderboard });
  });

  /** GET /api/season */
  app.get("/api/season", async (_req: Request, res: Response): Promise<void> => {
    const season = await storage.getActiveSeason();
    if (!season) {
      // Try completed season for winner info
      const allSeasons = await storage.getAllSeasons();
      const completed = allSeasons.filter((s) => s.status === "completed");
      if (completed.length > 0) {
        const latestSeason = completed[completed.length - 1];
        const allPlayers = await storage.getPlayersBySeasonId(latestSeason.id);
        const stockList = parseStockList(latestSeason);
        res.json({
          season: {
            ...latestSeason,
            playersAlive: 0,
            totalPlayers: allPlayers.length,
            stockList,
          },
        });
        return;
      }
      res.status(404).json({ message: "No active season" });
      return;
    }

    const allPlayers = await storage.getPlayersBySeasonId(season.id);
    const playersAlive = allPlayers.filter((p) => p.status === "alive").length;
    const stockList = parseStockList(season);

    res.json({
      season: {
        ...season,
        playersAlive,
        totalPlayers: allPlayers.length,
        stockList,
      },
    });
  });

  /** GET /api/history */
  app.get("/api/history", async (_req: Request, res: Response): Promise<void> => {
    const allSeasons = await storage.getAllSeasons();
    const completed = allSeasons.filter((s) => s.status === "completed");

    const history = await Promise.all(
      completed.map(async (season) => {
        const allPlayers = await storage.getPlayersBySeasonId(season.id);
        const winner = season.winnerId
          ? allPlayers.find((p) => p.id === season.winnerId)
          : undefined;
        return { season, winner, totalPlayers: allPlayers.length };
      })
    );

    res.json({ history });
  });

  // ── Admin ───────────────────────────────────────────────────────────────

  /** POST /api/admin/login */
  app.post("/api/admin/login", async (req: Request, res: Response): Promise<void> => {
    const { username, password } = req.body as { username?: string; password?: string };

    if (!username || !password) {
      res.status(400).json({ message: "username and password are required" });
      return;
    }

    const admin = await storage.getAdminByUsername(username);
    if (!admin || admin.password !== password) {
      res.status(401).json({ message: "Invalid credentials" });
      return;
    }

    const token = crypto.randomUUID();
    adminSessions.set(token, username);

    res.json({ token, username });
  });

  /** POST /api/admin/season */
  app.post(
    "/api/admin/season",
    requireAdmin,
    async (req: Request, res: Response): Promise<void> => {
      const {
        seasonNumber,
        startDate,
        stockList,
        prizeName,
        sponsorName,
        sponsorLogo,
        sponsorColor,
        sponsorAccent,
        sponsorTagline,
        sponsorCtaUrl,
        sponsorCtaText,
      } = req.body;

      if (!seasonNumber || !startDate || !stockList) {
        res.status(400).json({ message: "seasonNumber, startDate, and stockList are required" });
        return;
      }

      const season = await storage.createSeason({
        seasonNumber,
        startDate,
        status: "registration",
        stockList: JSON.stringify(stockList),
        prizeName: prizeName ?? "Prize Pack",
        sponsorName,
        sponsorLogo,
        sponsorColor: sponsorColor ?? "#00843D",
        sponsorAccent: sponsorAccent ?? "#FFD700",
        sponsorTagline,
        sponsorCtaUrl,
        sponsorCtaText,
        currentDay: 0,
        maxDays: MAX_SEASON_DAYS,
      });

      res.status(201).json({ season });
    }
  );

  /** POST /api/admin/season/:id/start */
  app.post(
    "/api/admin/season/:id/start",
    requireAdmin,
    async (req: Request, res: Response): Promise<void> => {
      const id = parseInt(req.params["id"] as string, 10);
      if (isNaN(id)) {
        res.status(400).json({ message: "Invalid season id" });
        return;
      }

      const season = await storage.getSeasonById(id);
      if (!season) {
        res.status(404).json({ message: "Season not found" });
        return;
      }

      const updated = await storage.updateSeason(id, {
        status: "active",
        currentDay: 1,
      });

      res.json({ season: updated });
    }
  );

  /** POST /api/admin/advance-day */
  app.post(
    "/api/admin/advance-day",
    requireAdmin,
    async (req: Request, res: Response): Promise<void> => {
      const season = await storage.getActiveSeason();
      if (!season || (season.status !== "active" && season.status !== "tiebreaker")) {
        res.status(400).json({ message: "No active season to advance" });
        return;
      }

      const maxDays = season.maxDays ?? MAX_SEASON_DAYS;

      // Don't advance past the max days unless in tiebreaker
      if (season.status === "active" && season.currentDay >= maxDays) {
        res.status(400).json({ message: `Cannot advance past Day ${maxDays}. Season limit reached.` });
        return;
      }

      const newDay = season.currentDay + 1;
      const updated = await storage.updateSeason(season.id, { currentDay: newDay });

      res.json({ season: updated, newDay });
    }
  );

  /** POST /api/admin/process-results */
  app.post(
    "/api/admin/process-results",
    requireAdmin,
    async (req: Request, res: Response): Promise<void> => {
      const { results } = req.body as {
        results?: Array<{ stockCode: string; closingPercent: number }>;
      };

      if (!results || !Array.isArray(results)) {
        res.status(400).json({ message: "results array is required" });
        return;
      }

      const season = await storage.getActiveSeason();
      if (!season || (season.status !== "active" && season.status !== "tiebreaker")) {
        res.status(400).json({ message: "No active season" });
        return;
      }

      const priceMap = new Map(results.map((r) => [r.stockCode, r.closingPercent]));
      const result = await processResultsCore(season, priceMap);
      res.json(result);
    }
  );

  /** POST /api/admin/auto-results — fetch real ASX prices and process results */
  app.post(
    "/api/admin/auto-results",
    requireAdmin,
    async (_req: Request, res: Response): Promise<void> => {
      const season = await storage.getActiveSeason();
      if (!season || (season.status !== "active" && season.status !== "tiebreaker")) {
        res.status(400).json({ message: "No active season" });
        return;
      }

      const dayPicks = await storage.getPicksByDay(season.id, season.currentDay);
      if (dayPicks.length === 0) {
        res.status(400).json({ message: "No picks for today" });
        return;
      }

      const stockCodes = [...new Set(dayPicks.map((p) => p.stockCode))];
      const priceMap = await fetchYahooPrices(stockCodes);

      if (priceMap.size === 0) {
        res.status(500).json({ message: "Could not fetch any stock prices" });
        return;
      }

      const result = await processResultsCore(season, priceMap);
      res.json({ ...result, prices: Object.fromEntries(priceMap) });
    }
  );

  /** POST /api/cron/process-daily — public endpoint for scheduled cron (no admin auth) */
  app.post("/api/cron/process-daily", async (req: Request, res: Response): Promise<void> => {
    const cronSecret = req.headers["x-cron-secret"];
    if (cronSecret !== "survivor-cron-2026") {
      res.status(403).json({ message: "Forbidden" });
      return;
    }

    const season = await storage.getActiveSeason();
    if (!season || (season.status !== "active" && season.status !== "tiebreaker")) {
      res.json({ message: "No active season", skipped: true });
      return;
    }

    // Step 1: Auto-assign picks
    const assigned = await autoAssignPicks(season);

    // Step 2: Fetch real prices from Yahoo Finance
    const dayPicks = await storage.getPicksByDay(season.id, season.currentDay);
    const stockCodes = [...new Set(dayPicks.map((p) => p.stockCode))];
    const priceMap = await fetchYahooPrices(stockCodes);

    if (priceMap.size === 0) {
      res.status(500).json({ message: "Could not fetch any prices" });
      return;
    }

    // Step 3: Process results (handles tiebreaker logic, day advancement, season completion)
    const result = await processResultsCore(season, priceMap);

    res.json({
      ...result,
      prices: Object.fromEntries(priceMap),
      autoAssigned: assigned,
    });
  });

  /** POST /api/admin/auto-assign */
  app.post(
    "/api/admin/auto-assign",
    requireAdmin,
    async (req: Request, res: Response): Promise<void> => {
      const season = await storage.getActiveSeason();
      if (!season || (season.status !== "active" && season.status !== "tiebreaker")) {
        res.status(400).json({ message: "No active season" });
        return;
      }

      const assigned = await autoAssignPicks(season);
      res.json({ assigned, count: assigned.length });
    }
  );

  /** GET /api/admin/dashboard */
  app.get(
    "/api/admin/dashboard",
    requireAdmin,
    async (_req: Request, res: Response): Promise<void> => {
      const season = await storage.getActiveSeason();
      if (!season) {
        res.json({ season: null, players: [], todaysPicks: [] });
        return;
      }

      const allPlayers = await storage.getPlayersBySeasonId(season.id);
      const todaysPicks =
        season.currentDay > 0
          ? await storage.getPicksByDay(season.id, season.currentDay)
          : [];

      const alivePlayers = allPlayers.filter((p) => p.status === "alive");
      const eliminatedPlayers = allPlayers.filter((p) => p.status === "eliminated");
      const pickedToday = new Set(todaysPicks.map((p) => p.playerId));
      const notPickedToday = alivePlayers.filter((p) => !pickedToday.has(p.id));

      res.json({
        season,
        stats: {
          totalPlayers: allPlayers.length,
          alivePlayers: alivePlayers.length,
          eliminatedPlayers: eliminatedPlayers.length,
          pickedToday: pickedToday.size,
          notPickedToday: notPickedToday.length,
        },
        players: allPlayers,
        todaysPicks,
      });
    }
  );

  /** POST /api/admin/reset-game — wipe everything and start fresh Season 1 */
  app.post(
    "/api/admin/reset-game",
    requireAdmin,
    async (_req: Request, res: Response): Promise<void> => {
      await storage.resetAllGameData();

      // Re-seed a fresh Season 1
      const today = new Date();
      const startDate = today.toISOString().split("T")[0];

      const stockPool = [
        { code: "WHC", name: "Whitehaven Coal", sequence: 1 },
        { code: "WBC", name: "Westpac Banking", sequence: 2 },
        { code: "CSL", name: "CSL Limited", sequence: 3 },
        { code: "ZIP", name: "Zip Co", sequence: 4 },
        { code: "LTR", name: "Liontown Resources", sequence: 5 },
        { code: "GYG", name: "Guzman y Gomez", sequence: 6 },
        { code: "KLI", name: "Killi Resources", sequence: 7 },
        { code: "DRO", name: "DroneShield", sequence: 8 },
        { code: "BRN", name: "BrainChip Holdings", sequence: 9 },
        { code: "NXT", name: "NEXTDC", sequence: 10 },
        { code: "COH", name: "Cochlear", sequence: 11 },
        { code: "BHP", name: "BHP Group", sequence: 12 },
        { code: "ILU", name: "Iluka Resources", sequence: 13 },
        { code: "MP1", name: "Megaport", sequence: 14 },
        { code: "TCL", name: "Transurban Group", sequence: 15 },
        { code: "BXB", name: "Brambles", sequence: 16 },
        { code: "WOW", name: "Woolworths Group", sequence: 17 },
        { code: "XYZ", name: "Block Inc", sequence: 18 },
        { code: "TYR", name: "Tyro Payments", sequence: 19 },
        { code: "MFG", name: "Magellan Financial Group", sequence: 20 },
      ];

      const season = await storage.createSeason({
        seasonNumber: 1,
        startDate,
        status: "registration",
        stockList: JSON.stringify(stockPool),
        prizeName: "Prize Pack",
        currentDay: 0,
        maxDays: MAX_SEASON_DAYS,
      });

      res.json({ message: "Game reset successfully", season });
    }
  );

  /** POST /api/admin/update-stocks — replace the active season's stock pool */
  app.post(
    "/api/admin/update-stocks",
    requireAdmin,
    async (req: Request, res: Response): Promise<void> => {
      const { stockList } = req.body as { stockList?: Array<{ code: string; name: string; sequence: number }> };
      if (!stockList || !Array.isArray(stockList)) {
        res.status(400).json({ message: "stockList array is required" });
        return;
      }

      const season = await storage.getActiveSeason();
      if (!season) {
        res.status(404).json({ message: "No active season" });
        return;
      }

      const updated = await storage.updateSeason(season.id, {
        stockList: JSON.stringify(stockList),
      });

      res.json({ season: updated, stockCount: stockList.length });
    }
  );

  /** POST /api/admin/seed */
  app.post("/api/admin/seed", async (_req: Request, res: Response): Promise<void> => {
    // Seed admin user if not exists
    const existingAdmin = await storage.getAdminByUsername("admin");
    if (!existingAdmin) {
      await storage.createAdmin({ username: "admin", password: "rodh" });
    }

    // Seed season 1 if no seasons exist
    const allSeasons = await storage.getAllSeasons();
    if (allSeasons.length === 0) {
      const today = new Date();
      const startDate = today.toISOString().split("T")[0];

      const stockPool = [
        { code: "WHC", name: "Whitehaven Coal", sequence: 1 },
        { code: "WBC", name: "Westpac Banking", sequence: 2 },
        { code: "CSL", name: "CSL Limited", sequence: 3 },
        { code: "ZIP", name: "Zip Co", sequence: 4 },
        { code: "LTR", name: "Liontown Resources", sequence: 5 },
        { code: "GYG", name: "Guzman y Gomez", sequence: 6 },
        { code: "KLI", name: "Killi Resources", sequence: 7 },
        { code: "DRO", name: "DroneShield", sequence: 8 },
        { code: "BRN", name: "BrainChip Holdings", sequence: 9 },
        { code: "NXT", name: "NEXTDC", sequence: 10 },
        { code: "COH", name: "Cochlear", sequence: 11 },
        { code: "BHP", name: "BHP Group", sequence: 12 },
        { code: "ILU", name: "Iluka Resources", sequence: 13 },
        { code: "MP1", name: "Megaport", sequence: 14 },
        { code: "TCL", name: "Transurban Group", sequence: 15 },
        { code: "BXB", name: "Brambles", sequence: 16 },
        { code: "WOW", name: "Woolworths Group", sequence: 17 },
        { code: "XYZ", name: "Block Inc", sequence: 18 },
        { code: "TYR", name: "Tyro Payments", sequence: 19 },
        { code: "MFG", name: "Magellan Financial Group", sequence: 20 },
      ];

      await storage.createSeason({
        seasonNumber: 1,
        startDate,
        status: "registration",
        stockList: JSON.stringify(stockPool),
        prizeName: "Prize Pack",
        currentDay: 0,
        maxDays: MAX_SEASON_DAYS,
      });
    }

    res.json({
      message: "Seed complete",
      admin: { username: "admin", password: "rodh" },
    });
  });

  return httpServer;
}

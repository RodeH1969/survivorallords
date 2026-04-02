import { useEffect, useState } from "react";
import { Link, useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { Skeleton } from "@/components/ui/skeleton";
import { TrendingUp, TrendingDown, ChevronRight, Lock, Users, Share2, Copy, Check } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";

export default function DashboardPage() {
  const { isLoggedIn, isLoading, player, season, todayPick, usedStocks, sessionToken, refetch } = useAuth();
  const [, setLocation] = useLocation();

  useEffect(() => {
    if (!isLoggedIn && !isLoading) setLocation("/login");
  }, [isLoggedIn, isLoading, setLocation]);

  // Refresh me data on mount
  useEffect(() => {
    refetch();
  }, []);

  const { data: leaderboardData, isLoading: lbLoading } = useQuery<any>({
    queryKey: ["/api/leaderboard"],
    enabled: !!sessionToken,
  });

  if (!player || !season) {
    return (
      <div className="min-h-screen bg-gray-50 p-4 space-y-4">
        <Skeleton className="h-12 w-full rounded-xl" />
        <Skeleton className="h-32 w-full rounded-xl" />
        <Skeleton className="h-24 w-full rounded-xl" />
      </div>
    );
  }

  const stockList: Array<{ code: string; name: string; sequence: number }> = season.stockList
    ? typeof season.stockList === "string"
      ? JSON.parse(season.stockList)
      : season.stockList
    : [];

  const alive = player.status === "alive";
  const isRegistration = season.status === "registration";
  const isActive = season.status === "active" || season.status === "tiebreaker";
  const isTiebreaker = season.status === "tiebreaker";
  const isCompleted = season.status === "completed";
  const winnerName = (season as any).winnerName;

  // Top 5 leaderboard
  const leaderboard: any[] = leaderboardData?.leaderboard?.slice(0, 5) ?? [];
  const alivePlayers = leaderboardData?.leaderboard?.filter((e: any) => e.player.status === "alive") ?? [];

  return (
    <div className="min-h-screen bg-gray-50 pb-24">
      {/* Winner announcement banner */}
      {isCompleted && winnerName && (
        <div
          className="px-4 py-6 text-center"
          style={{ backgroundColor: "#FFD700" }}
          data-testid="winner-banner"
        >
          <div className="text-4xl mb-2">🏆</div>
          <p
            className="text-2xl font-black text-gray-900 mb-1"
            style={{ fontFamily: "'Clash Display', sans-serif" }}
          >
            WINNER: {winnerName.toUpperCase()}
          </p>
          <p className="text-gray-700 text-sm font-medium">
            Season {season.seasonNumber} Champion
          </p>
        </div>
      )}
      {isCompleted && !winnerName && (
        <div
          className="px-4 py-6 text-center"
          style={{ backgroundColor: "#ef4444" }}
          data-testid="no-winner-banner"
        >
          <div className="text-4xl mb-2">💀</div>
          <p
            className="text-xl font-black text-white mb-1"
            style={{ fontFamily: "'Clash Display', sans-serif" }}
          >
            NO WINNER THIS SEASON
          </p>
          <p className="text-red-100 text-sm">
            All players were eliminated on the same day
          </p>
        </div>
      )}

      {/* Status bar */}
      <div
        className="px-4 py-3 text-center text-sm font-semibold text-white"
        style={{ backgroundColor: isTiebreaker ? "#B45309" : "#00843D" }}
        data-testid="status-bar"
      >
        {isTiebreaker
          ? `⚡ TIEBREAKER ${(season as any).tiebreakerType === "B" ? "B" : "A"} — Day ${season.currentDay} · ${alivePlayers.length} players tied`
          : isActive
          ? `Day ${season.currentDay} of 20 · ${alivePlayers.length} players alive`
          : isRegistration
          ? "Registration open — season hasn't started yet"
          : isCompleted
          ? "Season complete"
          : ""}
      </div>

      <div className="px-4 py-5 max-w-xl mx-auto space-y-4">
        {/* Player status card */}
        {alive ? (
          <div
            className="rounded-2xl px-5 py-4 border border-green-200"
            style={{ backgroundColor: "#f0fdf4" }}
            data-testid="status-card-alive"
          >
            <div className="flex items-center gap-2 mb-1">
              <span className="text-2xl">🟢</span>
              <span
                className="text-xl font-bold text-green-800"
                style={{ fontFamily: "'Clash Display', sans-serif" }}
              >
                YOU'RE ALIVE
              </span>
            </div>
            {isActive && (
              <p className="text-green-600 text-sm">
                Day {season.currentDay} streak — keep it up!
              </p>
            )}
          </div>
        ) : (
          <div
            className="rounded-2xl px-5 py-4 border border-red-200"
            style={{ backgroundColor: "#fef2f2" }}
            data-testid="status-card-eliminated"
          >
            <div className="flex items-center gap-2 mb-1">
              <span className="text-2xl">💀</span>
              <span
                className="text-xl font-bold text-red-800"
                style={{ fontFamily: "'Clash Display', sans-serif" }}
              >
                YOU WERE ELIMINATED
              </span>
            </div>
            <p className="text-red-600 text-sm">
              Eliminated on Day {player.eliminatedDay}. Better luck next season!
            </p>
          </div>
        )}

        {/* Tiebreaker info card */}
        {isTiebreaker && alive && (
          <div
            className="rounded-2xl px-5 py-4 border-2 border-amber-400"
            style={{ backgroundColor: "#FFFBEB" }}
            data-testid="tiebreaker-card"
          >
            <div className="flex items-center gap-2 mb-2">
              <span className="text-xl">⚡</span>
              <span
                className="text-lg font-bold text-amber-800"
                style={{ fontFamily: "'Clash Display', sans-serif" }}
              >
                TIEBREAKER {(season as any).tiebreakerType === "B" ? "B" : "A"}
              </span>
            </div>
            {(season as any).tiebreakerType === "B" ? (
              <p className="text-amber-700 text-sm">
                All 20 picks exhausted. Your tiebreaker stock is your Day 1 pick. Highest absolute % movement wins.
              </p>
            ) : (
              <p className="text-amber-700 text-sm">
                2 players remain. Pick from your remaining stocks. Highest absolute % movement wins — direction doesn't matter.
              </p>
            )}
          </div>
        )}

        {/* Today's pick section — only for alive players in active season */}
        {alive && isActive && (
          <div className="rounded-2xl bg-white border border-gray-100 shadow-sm overflow-hidden" data-testid="pick-section">
            <div className="px-5 py-4 border-b border-gray-100">
              <h2
                className="font-bold text-gray-900"
                style={{ fontFamily: "'Clash Display', sans-serif" }}
              >
                TODAY'S PICK
              </h2>
            </div>

            {todayPick ? (
              <div className="px-5 py-4">
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <p className="text-xs text-gray-400 uppercase tracking-wider mb-0.5">Your pick</p>
                    <p className="font-bold text-gray-900 text-lg" data-testid="pick-stock-code">
                      {todayPick.stockCode}
                    </p>
                    <p className="text-sm text-gray-600" data-testid="pick-stock-name">
                      {todayPick.stockName}
                    </p>
                  </div>
                  <div
                    className={`flex items-center gap-1.5 rounded-xl px-4 py-2 font-bold text-white text-sm ${
                      todayPick.direction === "up" ? "bg-green-600" : "bg-red-600"
                    }`}
                    data-testid="pick-direction"
                  >
                    {todayPick.direction === "up" ? (
                      <TrendingUp className="h-4 w-4" />
                    ) : (
                      <TrendingDown className="h-4 w-4" />
                    )}
                    {todayPick.direction.toUpperCase()}
                  </div>
                </div>
                {todayPick.isAuto ? (
                  <p className="text-xs text-gray-400 italic mb-3">⚡ Auto-assigned pick</p>
                ) : null}
                <Link
                  href="/pick"
                  className="block text-center w-full py-3 rounded-xl border border-gray-200 text-gray-700 text-sm font-semibold hover:bg-gray-50 transition-colors"
                  data-testid="link-change-pick"
                >
                  CHANGE MY PICK ✏️
                </Link>
              </div>
            ) : (
              <div className="px-5 py-6 text-center">
                <Link
                  href="/pick"
                  className="inline-block w-full py-5 rounded-2xl font-bold text-gray-900 text-xl animate-pulse-glow transition-all active:scale-95"
                  style={{
                    backgroundColor: "#FFD700",
                    fontFamily: "'Clash Display', sans-serif",
                  }}
                  data-testid="link-make-pick"
                >
                  MAKE YOUR PICK NOW 👆
                </Link>
                <p className="text-xs text-gray-400 mt-3">Picks close at 10am AEST</p>
              </div>
            )}
          </div>
        )}

        {/* Registration mode message */}
        {alive && isRegistration && (
          <div className="rounded-2xl bg-yellow-50 border border-yellow-200 px-5 py-4 text-center" data-testid="registration-banner">
            <p className="font-semibold text-yellow-800">⏳ Season hasn't started yet</p>
            <p className="text-yellow-700 text-sm mt-1">You're registered! Picks open when the season begins.</p>
          </div>
        )}

        {/* All players' picks — visible after 10am AEST */}
        {isActive && season.currentDay > 0 && (
          <TodaysPicks day={season.currentDay} currentPlayerId={player.id} />
        )}

        {/* Invite friends */}
        <InviteButton />

        {/* Prize callout */}
        <div
          className="rounded-2xl px-5 py-4 flex items-center gap-3"
          style={{ backgroundColor: "#FFD700" }}
          data-testid="prize-card"
        >
          <span className="text-3xl">🏆</span>
          <div>
            <p className="font-bold text-gray-900" style={{ fontFamily: "'Clash Display', sans-serif" }}>
              WIN A PRIZE PACK
            </p>
            {season.prizeName && season.prizeName !== "Prize Pack" && (
              <p className="text-gray-700 text-sm">{season.prizeName}</p>
            )}
          </div>
        </div>

        {/* Remaining stocks */}
        {isActive && stockList.length > 0 && (
          <div className="rounded-2xl bg-white border border-gray-100 shadow-sm" data-testid="stocks-section">
            <div className="px-5 py-3 border-b border-gray-100">
              <h2
                className="font-bold text-gray-900 text-sm"
                style={{ fontFamily: "'Clash Display', sans-serif" }}
              >
                YOUR STOCK POOL
              </h2>
            </div>
            <div className="px-4 py-3">
              <div className="flex flex-wrap gap-2">
                {stockList.map((stock) => {
                  const used = usedStocks.includes(stock.code);
                  return (
                    <div
                      key={stock.code}
                      className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors ${
                        used
                          ? "bg-gray-100 text-gray-300 border-gray-100 line-through"
                          : "bg-green-50 text-green-700 border-green-200"
                      }`}
                      title={stock.name}
                      data-testid={`stock-chip-${stock.code}`}
                    >
                      {stock.code}
                    </div>
                  );
                })}
              </div>
              <p className="text-xs text-gray-400 mt-2">
                {usedStocks.length} used · {stockList.length - usedStocks.length} remaining
              </p>
            </div>
          </div>
        )}

        {/* Leaderboard snapshot */}
        <div className="rounded-2xl bg-white border border-gray-100 shadow-sm" data-testid="leaderboard-snapshot">
          <div className="px-5 py-3 border-b border-gray-100 flex items-center justify-between">
            <h2
              className="font-bold text-gray-900 text-sm"
              style={{ fontFamily: "'Clash Display', sans-serif" }}
            >
              LEADERBOARD
            </h2>
            <Link
              href="/leaderboard"
              className="flex items-center gap-0.5 text-xs text-green-600 font-semibold"
              data-testid="link-full-leaderboard"
            >
              Full board <ChevronRight className="h-3 w-3" />
            </Link>
          </div>
          <div className="divide-y divide-gray-50">
            {lbLoading ? (
              Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="px-5 py-3 flex items-center gap-3">
                  <Skeleton className="h-4 w-5" />
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="h-4 w-16 ml-auto" />
                </div>
              ))
            ) : leaderboard.length === 0 ? (
              <div className="px-5 py-4 text-sm text-gray-400 text-center">No players yet</div>
            ) : (
              leaderboard.map((entry: any, i: number) => (
                <div
                  key={entry.player.id}
                  className={`px-5 py-3 flex items-center gap-3 ${
                    entry.player.id === player.id ? "bg-green-50" : ""
                  }`}
                  data-testid={`leaderboard-row-${entry.player.id}`}
                >
                  <span className="text-sm font-bold text-gray-400 w-5 text-center">
                    {i + 1}
                  </span>
                  <div className="flex-1 min-w-0">
                    <span className="text-sm font-semibold text-gray-900 truncate block">
                      {entry.player.displayName}
                      {entry.player.id === player.id && (
                        <span className="text-green-600 text-xs ml-1">(you)</span>
                      )}
                    </span>
                  </div>
                  <div className="text-right">
                    <span
                      className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                        entry.player.status === "alive"
                          ? "bg-green-100 text-green-700"
                          : "bg-gray-100 text-gray-500"
                      }`}
                    >
                      {entry.player.status === "alive"
                        ? `Day ${entry.daysSurvived}`
                        : "Out"}
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Invite Button component ──────────────────────────────────────────────────

function InviteButton() {
  const [copied, setCopied] = useState(false);

  const shareUrl = window.location.origin + window.location.pathname + "#/register";
  const shareText = "Join me on Survivor: All Ords \u2014 pick ASX stocks daily, last one standing wins! \ud83d\udcc8\ud83d\udd25";

  const handleShare = async () => {
    // Try native share first (works great on mobile)
    if (navigator.share) {
      try {
        await navigator.share({
          title: "Survivor: All Ords",
          text: shareText,
          url: shareUrl,
        });
        return;
      } catch {
        // User cancelled or share failed, fall through to copy
      }
    }

    // Fallback: copy link to clipboard
    try {
      await navigator.clipboard.writeText(`${shareText}\n${shareUrl}`);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      // Last resort: prompt
      prompt("Copy this link to share:", shareUrl);
    }
  };

  return (
    <button
      onClick={handleShare}
      className="w-full rounded-2xl px-5 py-4 flex items-center justify-center gap-2 border-2 border-dashed transition-all active:scale-95"
      style={{ borderColor: "#00843D", color: "#00843D" }}
      data-testid="button-invite"
    >
      {copied ? (
        <>
          <Check className="h-5 w-5" />
          <span className="font-bold text-sm" style={{ fontFamily: "'Clash Display', sans-serif" }}>
            LINK COPIED!
          </span>
        </>
      ) : (
        <>
          <Share2 className="h-5 w-5" />
          <span className="font-bold text-sm" style={{ fontFamily: "'Clash Display', sans-serif" }}>
            INVITE FRIENDS TO PLAY
          </span>
        </>
      )}
    </button>
  );
}

// ── Today's Picks component ─────────────────────────────────────────────────

function TodaysPicks({ day, currentPlayerId }: { day: number; currentPlayerId: number }) {
  const { data, isLoading, isError } = useQuery<{
    day: number;
    picks: Array<{
      id: number;
      playerId: number;
      playerName: string;
      playerStatus: string;
      stockCode: string;
      stockName: string;
      direction: string;
      isAuto: number;
      result: string | null;
    }>;
  }>({
    queryKey: ["/api/picks", day],
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/picks/${day}`);
      return res.json();
    },
    retry: false,
    refetchInterval: 60_000, // refresh every minute
  });

  // 403 means picks are still locked (before 10am AEST)
  if (isError) {
    return (
      <div
        className="rounded-2xl bg-white border border-gray-100 shadow-sm"
        data-testid="todays-picks-locked"
      >
        <div className="px-5 py-3 border-b border-gray-100 flex items-center gap-2">
          <Users className="h-4 w-4 text-gray-400" />
          <h2
            className="font-bold text-gray-900 text-sm"
            style={{ fontFamily: "'Clash Display', sans-serif" }}
          >
            TODAY'S PICKS
          </h2>
        </div>
        <div className="px-5 py-6 text-center">
          <Lock className="h-8 w-8 text-gray-300 mx-auto mb-2" />
          <p className="text-sm text-gray-500 font-medium">Picks revealed after 10am AEST</p>
          <p className="text-xs text-gray-400 mt-1">Once the market opens, you'll see what everyone picked</p>
        </div>
      </div>
    );
  }

  if (isLoading || !data) {
    return (
      <div className="rounded-2xl bg-white border border-gray-100 shadow-sm">
        <div className="px-5 py-3 border-b border-gray-100">
          <Skeleton className="h-4 w-32" />
        </div>
        <div className="px-5 py-3 space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-10 w-full rounded-lg" />
          ))}
        </div>
      </div>
    );
  }

  const picks = data.picks || [];

  if (picks.length === 0) {
    return (
      <div className="rounded-2xl bg-white border border-gray-100 shadow-sm">
        <div className="px-5 py-3 border-b border-gray-100 flex items-center gap-2">
          <Users className="h-4 w-4 text-gray-400" />
          <h2
            className="font-bold text-gray-900 text-sm"
            style={{ fontFamily: "'Clash Display', sans-serif" }}
          >
            TODAY'S PICKS
          </h2>
        </div>
        <div className="px-5 py-4 text-center text-sm text-gray-400">No picks yet today</div>
      </div>
    );
  }

  return (
    <div
      className="rounded-2xl bg-white border border-gray-100 shadow-sm overflow-hidden"
      data-testid="todays-picks"
    >
      <div className="px-5 py-3 border-b border-gray-100 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Users className="h-4 w-4 text-gray-400" />
          <h2
            className="font-bold text-gray-900 text-sm"
            style={{ fontFamily: "'Clash Display', sans-serif" }}
          >
            TODAY'S PICKS
          </h2>
        </div>
        <span className="text-xs text-gray-400">{picks.length} player{picks.length !== 1 ? "s" : ""}</span>
      </div>
      <div className="divide-y divide-gray-50">
        {picks.map((pick) => {
          const isYou = pick.playerId === currentPlayerId;
          return (
            <div
              key={pick.id}
              className={`px-5 py-3 flex items-center gap-3 ${isYou ? "bg-green-50" : ""}`}
              data-testid={`pick-row-${pick.playerId}`}
            >
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-gray-900 truncate">
                  {pick.playerName}
                  {isYou && <span className="text-green-600 text-xs ml-1">(you)</span>}
                  {pick.isAuto ? <span className="text-gray-400 text-xs ml-1">⚡auto</span> : null}
                </p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <span className="text-sm font-bold text-gray-900">{pick.stockCode}</span>
                <span
                  className={`flex items-center gap-1 text-xs font-bold px-2.5 py-1 rounded-full text-white ${
                    pick.direction === "up" ? "bg-green-600" : "bg-red-600"
                  }`}
                >
                  {pick.direction === "up" ? (
                    <TrendingUp className="h-3 w-3" />
                  ) : (
                    <TrendingDown className="h-3 w-3" />
                  )}
                  {pick.direction.toUpperCase()}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

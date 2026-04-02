import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { Skeleton } from "@/components/ui/skeleton";
import { TrendingUp, TrendingDown, ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { apiRequest } from "@/lib/queryClient";

export default function ResultsPage() {
  const { isLoggedIn, player, season: authSeason } = useAuth();

  // Season data — always fetch fresh from API regardless of login state
  const { data: publicSeasonData } = useQuery<any>({
    queryKey: ["/api/season"],
  });

  const currentSeason = publicSeasonData?.season ?? authSeason;
  const currentDay = currentSeason?.currentDay ?? 0;

  const [viewDay, setViewDay] = useState<number | null>(null);
  // Default to previous day (last completed day) since current day results may not be processed yet
  const day = viewDay ?? (currentDay > 1 ? currentDay - 1 : currentDay > 0 ? currentDay : 0);

  const { data, isLoading, error } = useQuery<any>({
    queryKey: ["/api/results", day],
    queryFn: async () => {
      if (day < 1) return null;
      const res = await apiRequest("GET", `/api/results/${day}`);
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    },
    enabled: day >= 1,
  });

  const results: any[] = data?.results ?? [];
  const casualties: any[] = data?.casualties ?? [];

  const myResult = isLoggedIn && player
    ? results.find((r: any) => r.player?.id === player.id)
    : null;

  const otherResults = results.filter((r: any) => r.player?.id !== player?.id);

  const canGoPrev = day > 1;
  const canGoNext = day < currentDay; // allows navigating to current day too (may show pending)

  return (
    <div className="min-h-screen bg-gray-50 pb-24">
      {/* Header */}
      <div
        className="px-4 py-4 text-white"
        style={{ backgroundColor: "#00843D" }}
      >
        <div className="max-w-xl mx-auto flex items-center justify-between">
          <button
            onClick={() => setViewDay(Math.max(1, day - 1))}
            disabled={!canGoPrev}
            className="p-2 rounded-full hover:bg-white/10 disabled:opacity-30 transition-colors"
            data-testid="button-prev-day"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
          <div className="text-center">
            <h1
              className="text-2xl font-bold uppercase"
              style={{ fontFamily: "'Clash Display', sans-serif" }}
              data-testid="results-heading"
            >
              DAY {day > 0 ? day : "—"} RESULTS 🔥
            </h1>
            {currentDay > 0 && (
              <p className="text-green-200 text-xs mt-0.5">
                Viewing Day {day > 0 ? day : "—"} of {currentDay}
              </p>
            )}
          </div>
          <button
            onClick={() => setViewDay(Math.min(currentDay, day + 1))}
            disabled={!canGoNext}
            className="p-2 rounded-full hover:bg-white/10 disabled:opacity-30 transition-colors"
            data-testid="button-next-day"
          >
            <ChevronRight className="h-5 w-5" />
          </button>
        </div>
      </div>

      <div className="px-4 py-5 max-w-xl mx-auto space-y-4">
        {/* No season / no results state */}
        {currentDay <= 0 ? (
          <div className="rounded-2xl bg-white border border-gray-100 shadow-sm px-5 py-10 text-center">
            <p className="text-4xl mb-3">📅</p>
            <p className="font-bold text-gray-800" style={{ fontFamily: "'Clash Display', sans-serif" }}>
              No results yet
            </p>
            <p className="text-gray-500 text-sm mt-1">Results appear here after each trading day.</p>
          </div>
        ) : isLoading ? (
          <div className="space-y-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-20 w-full rounded-xl" />
            ))}
          </div>
        ) : error ? (
          <div className="rounded-xl bg-amber-50 border border-amber-200 px-5 py-4 text-sm text-amber-700 text-center">
            Results for Day {day} are not available yet. Check back after 10am AEST.
          </div>
        ) : (
          <>
            {/* My result card — shown first if logged in */}
            {myResult && (
              <div
                className={cn(
                  "rounded-2xl px-5 py-4 border",
                  myResult.pick?.result === "tiebreaker_win"
                    ? "bg-amber-50 border-amber-300"
                    : myResult.pick?.result === "tiebreaker_draw"
                    ? "bg-amber-50 border-amber-200"
                    : myResult.pick?.result === "survived"
                    ? "bg-green-50 border-green-200"
                    : "bg-red-50 border-red-200"
                )}
                data-testid="my-result-card"
              >
                <p className="text-xs font-semibold uppercase tracking-widest text-gray-400 mb-1">Your Result</p>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-bold text-gray-900 text-lg" style={{ fontFamily: "'Clash Display', sans-serif" }}>
                      {myResult.pick?.result === "tiebreaker_win" ? "🏆 TIEBREAKER WINNER" :
                       myResult.pick?.result === "tiebreaker_draw" ? "⚡ TIEBREAKER DRAW" :
                       myResult.pick?.result === "tiebreaker_lose" ? "💀 TIEBREAKER LOSS" :
                       myResult.pick?.result === "survived" ? "✅ SURVIVED" : "💀 ELIMINATED"}
                    </p>
                    <p className="text-sm text-gray-600">
                      {myResult.pick?.stockCode} · {myResult.pick?.direction?.toUpperCase()}
                      {myResult.pick?.closingPercent !== null && myResult.pick?.closingPercent !== undefined && (
                        <span className={parseFloat(myResult.pick.closingPercent) >= 0 ? " text-green-600" : " text-red-600"}>
                          {" "}· {parseFloat(myResult.pick.closingPercent) >= 0 ? "+" : ""}{parseFloat(myResult.pick.closingPercent).toFixed(2)}%
                        </span>
                      )}
                    </p>
                  </div>
                  <span className="text-3xl">
                    {myResult.pick?.result === "survived" ? "🟢" : "🔴"}
                  </span>
                </div>
              </div>
            )}

            {/* All results list */}
            <div className="rounded-2xl bg-white border border-gray-100 shadow-sm overflow-hidden" data-testid="all-results">
              <div className="px-5 py-3 border-b border-gray-100">
                <h2
                  className="font-bold text-gray-900 text-sm"
                  style={{ fontFamily: "'Clash Display', sans-serif" }}
                >
                  ALL PICKS — DAY {day}
                </h2>
              </div>
              <div className="divide-y divide-gray-50">
                {results.length === 0 ? (
                  <div className="px-5 py-6 text-center text-gray-400 text-sm">
                    No results available for this day.
                  </div>
                ) : (
                  results.map((r: any) => {
                    const pick = r.pick;
                    const playerObj = r.player;
                    const isMe = isLoggedIn && playerObj?.id === player?.id;
                    const survived = pick?.result === "survived" || pick?.result === "tiebreaker_win" || pick?.result === "tiebreaker_draw";
                    const eliminated = pick?.result === "eliminated" || pick?.result === "tiebreaker_lose";
                    const pending = !pick?.result || pick?.result === "pending";
                    const isTiebreakerWin = pick?.result === "tiebreaker_win";
                    const isTiebreakerDraw = pick?.result === "tiebreaker_draw";

                    return (
                      <div
                        key={pick?.id ?? playerObj?.id}
                        className={cn(
                          "px-5 py-3 flex items-center gap-3",
                          isMe && "bg-green-50"
                        )}
                        data-testid={`result-row-${pick?.id}`}
                      >
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5">
                            <span className="font-semibold text-gray-900 text-sm truncate">
                              {playerObj?.displayName ?? "Unknown"}
                            </span>
                            {isMe && <span className="text-xs text-green-600">(you)</span>}
                            {pick?.isAuto ? (
                              <span className="text-[10px] bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded font-medium">AUTO</span>
                            ) : null}
                          </div>
                          <div className="flex items-center gap-1.5 mt-0.5">
                            <span className="text-xs text-gray-500">{pick?.stockCode}</span>
                            {pick?.direction === "up" ? (
                              <TrendingUp className="h-3 w-3 text-green-600" />
                            ) : (
                              <TrendingDown className="h-3 w-3 text-red-600" />
                            )}
                            <span className={cn("text-xs font-semibold", pick?.direction === "up" ? "text-green-600" : "text-red-600")}>
                              {pick?.direction?.toUpperCase()}
                            </span>
                            {pick?.closingPercent !== null && pick?.closingPercent !== undefined && (
                              <span className={cn(
                                "text-xs",
                                parseFloat(pick.closingPercent) >= 0 ? "text-green-600" : "text-red-600"
                              )}>
                                {parseFloat(pick.closingPercent) >= 0 ? "+" : ""}{parseFloat(pick.closingPercent).toFixed(2)}%
                              </span>
                            )}
                          </div>
                        </div>
                        <div>
                          {isTiebreakerWin && (
                            <span className="text-xs font-bold text-amber-800 bg-amber-100 px-2 py-1 rounded-full">🏆 WINNER</span>
                          )}
                          {isTiebreakerDraw && (
                            <span className="text-xs font-bold text-amber-700 bg-amber-100 px-2 py-1 rounded-full">⚡ DRAW</span>
                          )}
                          {survived && !isTiebreakerWin && !isTiebreakerDraw && (
                            <span className="text-xs font-bold text-green-700 bg-green-100 px-2 py-1 rounded-full">SURVIVED</span>
                          )}
                          {eliminated && (
                            <span className="text-xs font-bold text-red-700 bg-red-100 px-2 py-1 rounded-full">ELIMINATED</span>
                          )}
                          {pending && (
                            <span className="text-xs text-gray-400 bg-gray-100 px-2 py-1 rounded-full">PENDING</span>
                          )}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            {/* Casualties section */}
            {casualties.length > 0 && (
              <div
                className="rounded-2xl border border-red-200 overflow-hidden"
                style={{ backgroundColor: "#fef2f2" }}
                data-testid="casualties-section"
              >
                <div className="px-5 py-3 border-b border-red-200">
                  <h2
                    className="font-bold text-red-800 text-sm"
                    style={{ fontFamily: "'Clash Display', sans-serif" }}
                  >
                    TODAY'S CASUALTIES 💀
                  </h2>
                </div>
                <div className="px-5 py-3 flex flex-wrap gap-2">
                  {casualties.map((p: any) => (
                    <span
                      key={p?.id}
                      className="bg-red-100 text-red-700 text-sm font-semibold px-3 py-1 rounded-full"
                      data-testid={`casualty-${p?.id}`}
                    >
                      💀 {p?.displayName}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

export default function LeaderboardPage() {
  const { player } = useAuth();
  const [activeTab, setActiveTab] = useState<"current" | "alltime">("current");
  const [showEliminated, setShowEliminated] = useState(false);

  const { data: lbData, isLoading: lbLoading } = useQuery<any>({
    queryKey: ["/api/leaderboard"],
  });

  const { data: historyData, isLoading: historyLoading } = useQuery<any>({
    queryKey: ["/api/history"],
    enabled: activeTab === "alltime",
  });

  const leaderboard: any[] = lbData?.leaderboard ?? [];
  const alivePlayers = leaderboard.filter((e) => e.player.status === "alive");
  const eliminatedPlayers = leaderboard.filter((e) => e.player.status === "eliminated");
  const history: any[] = historyData?.history ?? [];

  return (
    <div className="min-h-screen bg-gray-50 pb-24">
      {/* Header */}
      <div
        className="px-4 py-4 text-white"
        style={{ backgroundColor: "#00843D" }}
      >
        <h1
          className="text-2xl font-bold text-center uppercase"
          style={{ fontFamily: "'Clash Display', sans-serif" }}
          data-testid="leaderboard-heading"
        >
          🏆 LEADERBOARD
        </h1>
      </div>

      {/* Tabs */}
      <div className="bg-white border-b border-gray-100 px-4">
        <div className="max-w-xl mx-auto flex">
          {[
            { key: "current", label: "CURRENT SEASON" },
            { key: "alltime", label: "ALL TIME" },
          ].map(({ key, label }) => (
            <button
              key={key}
              onClick={() => setActiveTab(key as "current" | "alltime")}
              className={cn(
                "flex-1 py-3 text-xs font-bold tracking-wider transition-colors border-b-2",
                activeTab === key
                  ? "text-green-700 border-green-600"
                  : "text-gray-400 border-transparent hover:text-gray-600"
              )}
              style={{ fontFamily: "'Clash Display', sans-serif" }}
              data-testid={`tab-${key}`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className="px-4 py-5 max-w-xl mx-auto">
        {activeTab === "current" && (
          <>
            {lbLoading ? (
              <div className="space-y-2">
                {Array.from({ length: 6 }).map((_, i) => (
                  <Skeleton key={i} className="h-16 w-full rounded-xl" />
                ))}
              </div>
            ) : leaderboard.length === 0 ? (
              <div className="rounded-2xl bg-white border border-gray-100 px-5 py-10 text-center">
                <p className="text-4xl mb-3">🎮</p>
                <p className="font-bold text-gray-800" style={{ fontFamily: "'Clash Display', sans-serif" }}>
                  No players yet
                </p>
                <p className="text-gray-500 text-sm mt-1">Register to be first on the board!</p>
              </div>
            ) : (
              <>
                {/* Season info */}
                {lbData?.season && (
                  <div className="rounded-2xl bg-white border border-gray-100 shadow-sm px-5 py-3 mb-4 flex items-center justify-between">
                    <div>
                      <p className="font-bold text-gray-900 text-sm" style={{ fontFamily: "'Clash Display', sans-serif" }}>
                        Season {lbData.season.seasonNumber}
                      </p>
                      <p className="text-xs text-gray-500">
                        {lbData.season.status === "active"
                          ? `Day ${lbData.season.currentDay}`
                          : lbData.season.status === "registration"
                          ? "Registration open"
                          : "Season complete"}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="font-bold text-green-700 text-lg">{alivePlayers.length}</p>
                      <p className="text-xs text-gray-400">still alive</p>
                    </div>
                  </div>
                )}

                {/* Alive players */}
                <div className="rounded-2xl bg-white border border-gray-100 shadow-sm overflow-hidden mb-4" data-testid="alive-players">
                  <div className="px-5 py-3 border-b border-gray-100">
                    <h2
                      className="font-bold text-gray-900 text-xs tracking-wider"
                      style={{ fontFamily: "'Clash Display', sans-serif" }}
                    >
                      🟢 ALIVE ({alivePlayers.length})
                    </h2>
                  </div>
                  <div className="divide-y divide-gray-50">
                    {alivePlayers.length === 0 ? (
                      <div className="px-5 py-4 text-sm text-gray-400 text-center">No alive players</div>
                    ) : (
                      alivePlayers.map((entry: any, i: number) => {
                        const isMe = player && entry.player.id === player.id;
                        return (
                          <div
                            key={entry.player.id}
                            className={cn(
                              "px-5 py-4 flex items-center gap-3",
                              isMe && "bg-green-50"
                            )}
                            data-testid={`leaderboard-alive-${entry.player.id}`}
                          >
                            {/* Rank */}
                            <div className="w-8 text-center flex-shrink-0">
                              {i === 0 ? (
                                <span className="text-xl">🥇</span>
                              ) : i === 1 ? (
                                <span className="text-xl">🥈</span>
                              ) : i === 2 ? (
                                <span className="text-xl">🥉</span>
                              ) : (
                                <span className="text-sm font-bold text-gray-400">#{i + 1}</span>
                              )}
                            </div>
                            {/* Name */}
                            <div className="flex-1 min-w-0">
                              <p className="font-semibold text-gray-900 truncate text-sm">
                                {entry.player.displayName}
                                {isMe && <span className="text-green-600 text-xs ml-1">(you)</span>}
                              </p>
                              <p className="text-xs text-gray-400">
                                {entry.picksRemaining} picks remaining
                              </p>
                            </div>
                            {/* Days */}
                            <div className="text-right flex-shrink-0">
                              <p className="font-bold text-green-700 text-base">
                                {entry.daysSurvived}
                              </p>
                              <p className="text-xs text-gray-400">days</p>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>

                {/* Eliminated players (collapsible) */}
                {eliminatedPlayers.length > 0 && (
                  <div className="rounded-2xl bg-white border border-gray-100 shadow-sm overflow-hidden" data-testid="eliminated-players">
                    <button
                      onClick={() => setShowEliminated(!showEliminated)}
                      className="w-full px-5 py-3 flex items-center justify-between"
                      data-testid="toggle-eliminated"
                    >
                      <h2
                        className="font-bold text-gray-500 text-xs tracking-wider"
                        style={{ fontFamily: "'Clash Display', sans-serif" }}
                      >
                        💀 ELIMINATED ({eliminatedPlayers.length})
                      </h2>
                      <span className="text-xs text-gray-400">{showEliminated ? "Hide" : "Show"}</span>
                    </button>
                    {showEliminated && (
                      <div className="divide-y divide-gray-50 border-t border-gray-100">
                        {eliminatedPlayers.map((entry: any, i: number) => {
                          const isMe = player && entry.player.id === player.id;
                          return (
                            <div
                              key={entry.player.id}
                              className={cn(
                                "px-5 py-3 flex items-center gap-3 opacity-60",
                                isMe && "opacity-80"
                              )}
                              data-testid={`leaderboard-eliminated-${entry.player.id}`}
                            >
                              <div className="w-8 text-center flex-shrink-0">
                                <span className="text-sm font-bold text-gray-400">
                                  #{alivePlayers.length + i + 1}
                                </span>
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="font-semibold text-gray-700 truncate text-sm line-through">
                                  {entry.player.displayName}
                                  {isMe && <span className="text-gray-500 text-xs ml-1 no-underline">(you)</span>}
                                </p>
                                <p className="text-xs text-gray-400">
                                  Day {entry.player.eliminatedDay ?? "?"} eliminated
                                </p>
                              </div>
                              <div className="text-right flex-shrink-0">
                                <p className="font-bold text-gray-500 text-base">{entry.daysSurvived}</p>
                                <p className="text-xs text-gray-400">days</p>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}
              </>
            )}
          </>
        )}

        {activeTab === "alltime" && (
          <>
            {historyLoading ? (
              <div className="space-y-3">
                {Array.from({ length: 3 }).map((_, i) => (
                  <Skeleton key={i} className="h-28 w-full rounded-xl" />
                ))}
              </div>
            ) : history.length === 0 ? (
              <div className="rounded-2xl bg-white border border-gray-100 px-5 py-10 text-center">
                <p className="text-4xl mb-3">📜</p>
                <p className="font-bold text-gray-800" style={{ fontFamily: "'Clash Display', sans-serif" }}>
                  No completed seasons yet
                </p>
                <p className="text-gray-500 text-sm mt-1">Season history will appear here once the first season ends.</p>
              </div>
            ) : (
              <div className="space-y-3" data-testid="season-history">
                {history.map(({ season, winner, totalPlayers }: any) => (
                  <div
                    key={season.id}
                    className="rounded-2xl bg-white border border-gray-100 shadow-sm px-5 py-4"
                    data-testid={`season-card-${season.id}`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p
                          className="font-bold text-gray-900"
                          style={{ fontFamily: "'Clash Display', sans-serif" }}
                        >
                          Season {season.seasonNumber}
                        </p>
                        <p className="text-xs text-gray-400 mt-0.5">
                          Started {season.startDate} · {totalPlayers} players
                        </p>
                      </div>
                      <span className="text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded-full font-semibold">
                        Complete
                      </span>
                    </div>
                    {winner ? (
                      <div className="mt-3 flex items-center gap-2 rounded-xl bg-yellow-50 border border-yellow-200 px-4 py-2">
                        <span className="text-xl">🏆</span>
                        <div>
                          <p className="text-xs text-gray-500">Winner</p>
                          <p className="font-bold text-yellow-800">{winner.displayName}</p>
                        </div>
                      </div>
                    ) : (
                      <div className="mt-3 rounded-xl bg-gray-50 border border-gray-100 px-4 py-2">
                        <p className="text-xs text-gray-400 italic">No winner</p>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

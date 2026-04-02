import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { Skeleton } from "@/components/ui/skeleton";
import { Shield, LogOut } from "lucide-react";

const API_BASE = "__PORT_5000__".startsWith("__") ? "" : "__PORT_5000__";

async function adminFetch(url: string, method = "GET", body?: any, token?: string) {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (token) headers["x-session-token"] = token;
  const res = await fetch(`${API_BASE}${url}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  if (!res.ok) {
    let msg = text;
    try { msg = JSON.parse(text)?.message ?? text; } catch {}
    throw new Error(msg);
  }
  try { return JSON.parse(text); } catch { return text; }
}

type StockResult = { stockCode: string; closingPercent: string };

export default function AdminPage() {
  const { toast } = useToast();
  const qc = useQueryClient();

  // Admin auth — auto-login, no password screen
  const [adminToken, setAdminToken] = useState<string | null>(null);
  const [adminUsername, setAdminUsername] = useState("");
  const [autoLoginDone, setAutoLoginDone] = useState(false);

  // Process results state
  const [stockResults, setStockResults] = useState<StockResult[]>([]);
  const [processingResults, setProcessingResults] = useState(false);

  // Dashboard query
  const { data: dashData, isLoading: dashLoading, refetch: refetchDash } = useQuery<any>({
    queryKey: ["/api/admin/dashboard", adminToken],
    queryFn: () => adminFetch("/api/admin/dashboard", "GET", undefined, adminToken!),
    enabled: !!adminToken,
    retry: false,
  });

  const season = dashData?.season;
  const players: any[] = dashData?.players ?? [];
  const todaysPicks: any[] = dashData?.todaysPicks ?? [];

  // ─── Auto-login on mount ────────────────────────────────────────────
  if (!autoLoginDone) {
    setAutoLoginDone(true);
    adminFetch("/api/admin/login", "POST", { username: "admin", password: "rodh" })
      .then((data) => {
        setAdminToken(data.token);
        setAdminUsername(data.username);
      })
      .catch(() => {
        // Try fallback seed password
        adminFetch("/api/admin/login", "POST", { username: "admin", password: "survivor2026" })
          .then((data) => {
            setAdminToken(data.token);
            setAdminUsername(data.username);
          })
          .catch(() => {});
      });
  }

  // ─── Admin actions ────────────────────────────────────────────────────
  const runAction = async (label: string, fn: () => Promise<any>) => {
    try {
      const result = await fn();
      toast({ title: `${label} ✅`, description: JSON.stringify(result).slice(0, 120) });
      refetchDash();
    } catch (err: any) {
      toast({ title: `${label} failed ❌`, description: err.message, variant: "destructive" });
    }
  };

  const handleSeed = () => runAction("Seed", () => adminFetch("/api/admin/seed", "POST", {}, adminToken!));
  const handleStartSeason = () => {
    if (!season) return toast({ title: "No season to start", variant: "destructive" });
    runAction("Start Season", () => adminFetch(`/api/admin/season/${season.id}/start`, "POST", {}, adminToken!));
  };
  const handleAdvanceDay = () => runAction("Advance Day", () => adminFetch("/api/admin/advance-day", "POST", {}, adminToken!));
  const handleAutoAssign = () => runAction("Auto Assign", () => adminFetch("/api/admin/auto-assign", "POST", {}, adminToken!));
  const handleAutoResults = () => runAction("Auto Results", () => adminFetch("/api/admin/auto-results", "POST", {}, adminToken!));
  const [resetting, setResetting] = useState(false);
  const handleResetGame = async () => {
    if (!confirm("Are you sure? This will delete ALL players, picks, and results and start a completely fresh Season 1.")) return;
    setResetting(true);
    try {
      const result = await adminFetch("/api/admin/reset-game", "POST", {}, adminToken!);
      toast({ title: "Game reset ✅", description: "Fresh Season 1 created. Share the link to invite players." });
      refetchDash();
    } catch (err: any) {
      toast({ title: "Reset failed ❌", description: err.message, variant: "destructive" });
    } finally {
      setResetting(false);
    }
  };

  // Build results form from today's picks stocks
  const pickedStockCodes = Array.from(new Set(todaysPicks.map((p: any) => p.stockCode as string)));
  const handleProcessResults = async () => {
    setProcessingResults(true);
    try {
      const results = stockResults
        .filter((r) => r.stockCode && r.closingPercent !== "")
        .map((r) => ({ stockCode: r.stockCode, closingPercent: parseFloat(r.closingPercent) }));
      const data = await adminFetch("/api/admin/process-results", "POST", { results }, adminToken!);
      toast({ title: "Results processed ✅", description: `${data.casualties?.length ?? 0} casualty(ies)` });
      setStockResults([]);
      refetchDash();
    } catch (err: any) {
      toast({ title: "Process results failed ❌", description: err.message, variant: "destructive" });
    } finally {
      setProcessingResults(false);
    }
  };

  // Initialize stock results when picks change
  const initResultsForToday = () => {
    const codes = Array.from(new Set(todaysPicks.map((p: any) => p.stockCode as string)));
    setStockResults(codes.map((code) => ({ stockCode: code, closingPercent: "" })));
  };

  // ─── Loading / not logged in ────────────────────────────────────────
  if (!adminToken) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col">
        <div
          className="px-4 py-4 text-white flex items-center gap-2"
          style={{ backgroundColor: "#1a1a1a" }}
        >
          <Shield className="h-5 w-5 text-yellow-400" />
          <h1
            className="text-xl font-bold"
            style={{ fontFamily: "'Clash Display', sans-serif" }}
          >
            Admin Panel
          </h1>
        </div>
        <div className="flex-1 flex items-center justify-center px-6 py-12">
          <p className="text-gray-400 text-sm">Loading admin panel...</p>
        </div>
      </div>
    );
  }

  // ─── Logged-in admin dashboard ────────────────────────────────────────
  return (
    <div className="min-h-screen bg-gray-50">
      {/* Admin header */}
      <div
        className="px-4 py-3 text-white flex items-center justify-between sticky top-0 z-50"
        style={{ backgroundColor: "#1a1a1a" }}
      >
        <div className="flex items-center gap-2">
          <Shield className="h-5 w-5 text-yellow-400" />
          <span
            className="font-bold"
            style={{ fontFamily: "'Clash Display', sans-serif" }}
          >
            ADMIN — {adminUsername}
          </span>
        </div>
        <button
          onClick={() => { setAdminToken(null); setAdminUsername(""); }}
          className="flex items-center gap-1.5 text-gray-300 hover:text-white text-sm"
          data-testid="button-admin-logout"
        >
          <LogOut className="h-4 w-4" />
          Log out
        </button>
      </div>

      <div className="px-4 py-5 max-w-2xl mx-auto space-y-4">
        {/* Season status card */}
        <div className="rounded-2xl bg-white border border-gray-200 shadow-sm px-5 py-4" data-testid="admin-season-card">
          <h2
            className="font-bold text-gray-900 text-sm mb-3"
            style={{ fontFamily: "'Clash Display', sans-serif" }}
          >
            SEASON STATUS
          </h2>
          {dashLoading ? (
            <div className="space-y-2">
              <Skeleton className="h-4 w-48" />
              <Skeleton className="h-4 w-32" />
            </div>
          ) : season ? (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {[
                { label: "Season", value: season.seasonNumber },
                { label: "Status", value: season.status },
                { label: "Day", value: season.currentDay },
                { label: "Alive", value: dashData?.stats?.alivePlayers ?? 0 },
              ].map(({ label, value }) => (
                <div key={label} className="rounded-xl bg-gray-50 border border-gray-100 px-3 py-2 text-center">
                  <p className="text-xs text-gray-400">{label}</p>
                  <p className="font-bold text-gray-900 capitalize text-sm">{value}</p>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-gray-500">No active season. Run "Seed Demo Data" first.</p>
          )}
        </div>

        {/* Action buttons */}
        <div className="rounded-2xl bg-white border border-gray-200 shadow-sm px-5 py-4" data-testid="admin-actions">
          <h2
            className="font-bold text-gray-900 text-sm mb-3"
            style={{ fontFamily: "'Clash Display', sans-serif" }}
          >
            ACTIONS
          </h2>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <button
              onClick={handleSeed}
              className="py-3 px-3 rounded-xl bg-gray-900 text-white text-xs font-bold hover:bg-gray-700 transition-colors"
              data-testid="button-seed"
            >
              🌱 Seed Demo Data
            </button>
            <button
              onClick={handleStartSeason}
              disabled={!season || season.status !== "registration"}
              className="py-3 px-3 rounded-xl bg-green-700 text-white text-xs font-bold hover:bg-green-600 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              data-testid="button-start-season"
            >
              ▶️ Start Season
            </button>
            <button
              onClick={handleAdvanceDay}
              disabled={!season || season.status !== "active"}
              className="py-3 px-3 rounded-xl bg-blue-700 text-white text-xs font-bold hover:bg-blue-600 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              data-testid="button-advance-day"
            >
              ⏭️ Advance Day
            </button>
            <button
              onClick={handleAutoAssign}
              disabled={!season || season.status !== "active"}
              className="py-3 px-3 rounded-xl bg-amber-600 text-white text-xs font-bold hover:bg-amber-500 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              data-testid="button-auto-assign"
            >
              ⚡ Auto-Assign
            </button>
            <button
              onClick={handleAutoResults}
              disabled={!season || season.status !== "active"}
              className="py-3 px-3 rounded-xl text-white text-xs font-bold hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              style={{ backgroundColor: "#00843D" }}
              data-testid="button-auto-results"
            >
              📊 Auto Results
            </button>
          </div>
          <div className="mt-3 pt-3 border-t border-gray-100">
            <button
              onClick={handleResetGame}
              disabled={resetting}
              className="w-full py-3 px-3 rounded-xl bg-red-600 text-white text-xs font-bold hover:bg-red-500 disabled:opacity-50 transition-colors"
              data-testid="button-reset-game"
            >
              {resetting ? "Resetting..." : "🔄 RESET GAME (Start Fresh)"}
            </button>
          </div>
        </div>

        {/* Process Results */}
        {season?.status === "active" && season.currentDay > 0 && (
          <div className="rounded-2xl bg-white border border-gray-200 shadow-sm px-5 py-4" data-testid="admin-process-results">
            <div className="flex items-center justify-between mb-3">
              <h2
                className="font-bold text-gray-900 text-sm"
                style={{ fontFamily: "'Clash Display', sans-serif" }}
              >
                PROCESS RESULTS — DAY {season.currentDay}
              </h2>
              {todaysPicks.length > 0 && stockResults.length === 0 && (
                <button
                  onClick={initResultsForToday}
                  className="text-xs text-blue-600 underline"
                  data-testid="button-init-results"
                >
                  Load today's stocks
                </button>
              )}
            </div>

            {stockResults.length === 0 ? (
              <p className="text-sm text-gray-500">
                {todaysPicks.length === 0
                  ? "No picks for today yet."
                  : `${pickedStockCodes.length} stock(s) picked today. Click "Load today's stocks" to enter closing prices.`}
              </p>
            ) : (
              <div className="space-y-3">
                {stockResults.map((r, i) => (
                  <div key={r.stockCode} className="flex items-center gap-3">
                    <span className="font-bold text-gray-900 w-12 text-sm">{r.stockCode}</span>
                    <input
                      type="number"
                      step="0.01"
                      value={r.closingPercent}
                      onChange={(e) => {
                        const updated = [...stockResults];
                        updated[i] = { ...r, closingPercent: e.target.value };
                        setStockResults(updated);
                      }}
                      placeholder="Closing % (e.g. 1.23 or -0.45)"
                      className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
                      data-testid={`input-result-${r.stockCode}`}
                    />
                  </div>
                ))}
                {/* Add manual entry */}
                <div className="flex items-center gap-2 pt-2 border-t border-gray-100">
                  <button
                    onClick={() => setStockResults([...stockResults, { stockCode: "", closingPercent: "" }])}
                    className="text-xs text-gray-500 hover:text-gray-700 underline"
                  >
                    + Add stock
                  </button>
                </div>
                <button
                  onClick={handleProcessResults}
                  disabled={processingResults}
                  className="w-full py-3 rounded-xl font-bold text-white text-sm disabled:opacity-50 transition-all"
                  style={{ backgroundColor: "#00843D" }}
                  data-testid="button-process-results"
                >
                  {processingResults ? "Processing..." : "📊 PROCESS RESULTS"}
                </button>
              </div>
            )}
          </div>
        )}

        {/* Players list */}
        <div className="rounded-2xl bg-white border border-gray-200 shadow-sm overflow-hidden" data-testid="admin-players">
          <div className="px-5 py-3 border-b border-gray-100 flex items-center justify-between">
            <h2
              className="font-bold text-gray-900 text-sm"
              style={{ fontFamily: "'Clash Display', sans-serif" }}
            >
              PLAYERS ({players.length})
            </h2>
            <div className="text-xs text-gray-400 space-x-3">
              <span className="text-green-600 font-semibold">
                {players.filter((p) => p.status === "alive").length} alive
              </span>
              <span className="text-red-600 font-semibold">
                {players.filter((p) => p.status === "eliminated").length} out
              </span>
            </div>
          </div>
          <div className="divide-y divide-gray-50 max-h-64 overflow-y-auto">
            {dashLoading ? (
              Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="px-5 py-3 flex gap-3">
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="h-4 w-16 ml-auto" />
                </div>
              ))
            ) : players.length === 0 ? (
              <div className="px-5 py-4 text-sm text-gray-400 text-center">No players registered.</div>
            ) : (
              players.map((p: any) => (
                <div
                  key={p.id}
                  className="px-5 py-3 flex items-center justify-between gap-3"
                  data-testid={`admin-player-${p.id}`}
                >
                  <div>
                    <p className="font-semibold text-gray-900 text-sm">{p.displayName}</p>
                    <p className="text-xs text-gray-400">{p.mobile}</p>
                  </div>
                  <span
                    className={`text-xs font-bold px-2 py-1 rounded-full ${
                      p.status === "alive"
                        ? "bg-green-100 text-green-700"
                        : "bg-red-100 text-red-700"
                    }`}
                  >
                    {p.status === "alive" ? "ALIVE" : `OUT D${p.eliminatedDay}`}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Today's picks */}
        {season?.status === "active" && (
          <div className="rounded-2xl bg-white border border-gray-200 shadow-sm overflow-hidden" data-testid="admin-todays-picks">
            <div className="px-5 py-3 border-b border-gray-100">
              <h2
                className="font-bold text-gray-900 text-sm"
                style={{ fontFamily: "'Clash Display', sans-serif" }}
              >
                TODAY'S PICKS ({todaysPicks.length})
                {dashData?.stats && (
                  <span className="text-xs text-gray-400 ml-2 font-normal">
                    · {dashData.stats.notPickedToday} not picked
                  </span>
                )}
              </h2>
            </div>
            <div className="divide-y divide-gray-50 max-h-64 overflow-y-auto">
              {todaysPicks.length === 0 ? (
                <div className="px-5 py-4 text-sm text-gray-400 text-center">No picks submitted yet today.</div>
              ) : (
                todaysPicks.map((pick: any) => {
                  const p = players.find((pl) => pl.id === pick.playerId);
                  return (
                    <div
                      key={pick.id}
                      className="px-5 py-3 flex items-center justify-between gap-3"
                      data-testid={`admin-pick-${pick.id}`}
                    >
                      <div>
                        <p className="font-semibold text-gray-900 text-sm">
                          {p?.displayName ?? `Player ${pick.playerId}`}
                        </p>
                        <p className="text-xs text-gray-400">
                          {pick.stockCode} · {pick.direction.toUpperCase()}
                          {pick.isAuto ? " · AUTO" : ""}
                        </p>
                      </div>
                      <span
                        className={`text-xs font-bold px-2 py-1 rounded-full ${
                          pick.result === "survived"
                            ? "bg-green-100 text-green-700"
                            : pick.result === "eliminated"
                            ? "bg-red-100 text-red-700"
                            : "bg-gray-100 text-gray-500"
                        }`}
                      >
                        {pick.result?.toUpperCase() ?? "PENDING"}
                      </span>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

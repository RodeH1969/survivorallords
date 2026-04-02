import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/contexts/AuthContext";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { TrendingUp, TrendingDown, CheckCircle } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

type Stock = { code: string; name: string; sequence: number };

export default function PickPage() {
  const { isLoggedIn, isLoading, player, season, usedStocks, refetch } = useAuth();
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  const [selectedStock, setSelectedStock] = useState<Stock | null>(null);
  const [selectedDirection, setSelectedDirection] = useState<"up" | "down" | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!isLoggedIn && !isLoading) setLocation("/login");
  }, [isLoggedIn, isLoading, setLocation]);

  useEffect(() => {
    if (player?.status === "eliminated") setLocation("/dashboard");
  }, [player, setLocation]);

  if (!player || !season) {
    return (
      <div className="min-h-screen bg-gray-50 p-4 space-y-4">
        <Skeleton className="h-12 w-full rounded-xl" />
        <Skeleton className="h-64 w-full rounded-xl" />
      </div>
    );
  }

  if (season.status !== "active") {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center px-6 text-center">
        <div>
          <p className="text-4xl mb-3">⏳</p>
          <p className="font-bold text-gray-800 text-xl" style={{ fontFamily: "'Clash Display', sans-serif" }}>
            Season hasn't started
          </p>
          <p className="text-gray-500 text-sm mt-2">Picks open when the season begins.</p>
        </div>
      </div>
    );
  }

  const stockList: Stock[] = season.stockList
    ? typeof season.stockList === "string"
      ? JSON.parse(season.stockList)
      : season.stockList
    : [];

  // Filter out stocks already used by this player (but allow today's pick stock)
  const availableStocks = stockList.filter((s) => !usedStocks.includes(s.code));

  const handleConfirm = async () => {
    if (!selectedStock || !selectedDirection) {
      setError("Please select a stock and direction.");
      return;
    }
    setError("");
    setSubmitting(true);
    try {
      await apiRequest("POST", "/api/pick", {
        stockCode: selectedStock.code,
        stockName: selectedStock.name,
        direction: selectedDirection,
      });
      await refetch();
      toast({
        title: "Pick confirmed! ✅",
        description: `${selectedStock.code} ${selectedDirection.toUpperCase()} — good luck!`,
      });
      setLocation("/dashboard");
    } catch (err: any) {
      const msg = err?.message || "Failed to submit pick. Please try again.";
      const match = msg.match(/^\d+:\s*(.+)/);
      setError(match ? match[1] : msg);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 pb-24">
      {/* Header */}
      <div
        className="px-4 py-4 text-center text-white"
        style={{ backgroundColor: "#00843D" }}
      >
        <h1
          className="text-2xl font-bold uppercase"
          style={{ fontFamily: "'Clash Display', sans-serif" }}
          data-testid="pick-heading"
        >
          DAY {season.currentDay} PICK
        </h1>
        <p className="text-green-200 text-sm mt-0.5">
          {availableStocks.length} stocks available
        </p>
      </div>

      <div className="px-4 py-5 max-w-xl mx-auto space-y-5">
        {/* Step 1: Pick a stock */}
        <div className="rounded-2xl bg-white border border-gray-100 shadow-sm overflow-hidden" data-testid="stock-selector">
          <div className="px-5 py-3 border-b border-gray-100">
            <h2
              className="font-bold text-gray-900 text-sm"
              style={{ fontFamily: "'Clash Display', sans-serif" }}
            >
              STEP 1 — PICK YOUR STOCK
            </h2>
          </div>
          <div className="divide-y divide-gray-50 max-h-72 overflow-y-auto">
            {availableStocks.length === 0 ? (
              <div className="px-5 py-6 text-center text-gray-400 text-sm">
                No stocks available. You may have used them all!
              </div>
            ) : (
              availableStocks.map((stock) => {
                const isSelected = selectedStock?.code === stock.code;
                return (
                  <button
                    key={stock.code}
                    onClick={() => {
                      setSelectedStock(stock);
                      setSelectedDirection(null);
                    }}
                    className={`w-full text-left px-5 py-4 flex items-center gap-4 transition-colors ${
                      isSelected
                        ? "bg-green-50 border-l-4 border-green-600"
                        : "hover:bg-gray-50"
                    }`}
                    data-testid={`stock-option-${stock.code}`}
                  >
                    <div className="flex-1 min-w-0">
                      <p className="font-bold text-gray-900">{stock.name}</p>
                      <p className="text-sm text-gray-500">{stock.code}</p>
                    </div>
                    {isSelected && <CheckCircle className="h-5 w-5 text-green-600 flex-shrink-0" />}
                  </button>
                );
              })
            )}
          </div>
        </div>

        {/* Step 2: Direction (shown after stock selected) */}
        {selectedStock && (
          <div className="rounded-2xl bg-white border border-gray-100 shadow-sm overflow-hidden" data-testid="direction-selector">
            <div className="px-5 py-3 border-b border-gray-100">
              <h2
                className="font-bold text-gray-900 text-sm"
                style={{ fontFamily: "'Clash Display', sans-serif" }}
              >
                STEP 2 — UP OR DOWN? ({selectedStock.code})
              </h2>
            </div>
            <div className="px-4 py-4 flex gap-3">
              <button
                onClick={() => setSelectedDirection("up")}
                className={`flex-1 flex flex-col items-center gap-2 py-5 rounded-2xl border-2 font-bold text-lg transition-all active:scale-95 ${
                  selectedDirection === "up"
                    ? "bg-green-600 border-green-600 text-white shadow-lg"
                    : "bg-green-50 border-green-200 text-green-700 hover:bg-green-100"
                }`}
                style={{ fontFamily: "'Clash Display', sans-serif" }}
                data-testid="button-direction-up"
              >
                <TrendingUp className="h-8 w-8" />
                ⬆️ UP
              </button>
              <button
                onClick={() => setSelectedDirection("down")}
                className={`flex-1 flex flex-col items-center gap-2 py-5 rounded-2xl border-2 font-bold text-lg transition-all active:scale-95 ${
                  selectedDirection === "down"
                    ? "bg-red-600 border-red-600 text-white shadow-lg"
                    : "bg-red-50 border-red-200 text-red-700 hover:bg-red-100"
                }`}
                style={{ fontFamily: "'Clash Display', sans-serif" }}
                data-testid="button-direction-down"
              >
                <TrendingDown className="h-8 w-8" />
                ⬇️ DOWN
              </button>
            </div>
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700" data-testid="pick-error">
            {error}
          </div>
        )}

        {/* Confirm button */}
        <button
          onClick={handleConfirm}
          disabled={!selectedStock || !selectedDirection || submitting}
          className="w-full py-5 rounded-2xl font-bold text-xl text-gray-900 disabled:opacity-40 disabled:cursor-not-allowed transition-all active:scale-95 hover:brightness-105"
          style={{
            backgroundColor: "#FFD700",
            fontFamily: "'Clash Display', sans-serif",
          }}
          data-testid="button-confirm-pick"
        >
          {submitting ? "Confirming..." : "CONFIRM PICK ✅"}
        </button>

        {/* Auto-pick notice */}
        <p className="text-center text-xs text-gray-400">
          ⚡ If you don't make a pick by 10am AEST, the lowest-sequence unused stock will be auto-assigned with DOWN direction.
        </p>
      </div>
    </div>
  );
}

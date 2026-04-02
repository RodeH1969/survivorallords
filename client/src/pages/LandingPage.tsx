import { useEffect } from "react";
import { Link, useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { Skeleton } from "@/components/ui/skeleton";
import { TrendingUp, Target, Skull } from "lucide-react";
import logoPath from "@assets/logo.jpg";

export default function LandingPage() {
  const { isLoggedIn } = useAuth();
  const [, setLocation] = useLocation();

  // Redirect logged-in users to dashboard
  useEffect(() => {
    if (isLoggedIn) setLocation("/dashboard");
  }, [isLoggedIn, setLocation]);

  const { data: seasonData, isLoading: seasonLoading } = useQuery<any>({
    queryKey: ["/api/season"],
    retry: false,
  });

  const season = seasonData?.season;

  return (
    <div className="min-h-screen bg-white flex flex-col">
      {/* Hero */}
      <div
        className="relative flex flex-col items-center justify-center px-6 pt-12 pb-10 text-center overflow-hidden"
        style={{ background: "linear-gradient(160deg, #00843D 0%, #005a2b 100%)" }}
      >
        {/* Background pattern */}
        <div className="absolute inset-0 opacity-10">
          <div
            className="absolute inset-0"
            style={{
              backgroundImage:
                "repeating-linear-gradient(45deg, #FFD700 0, #FFD700 1px, transparent 0, transparent 50%)",
              backgroundSize: "20px 20px",
            }}
          />
        </div>

        <div className="relative z-10 flex flex-col items-center gap-5 max-w-sm">
          <img
            src={logoPath}
            alt="Survivor: All Ords"
            className="h-28 w-28 rounded-full object-cover border-4 border-yellow-400 shadow-2xl"
            data-testid="hero-logo"
          />
          <div>
            <h1
              className="text-4xl font-bold text-white tracking-tight leading-none uppercase"
              style={{ fontFamily: "'Clash Display', sans-serif" }}
              data-testid="hero-title"
            >
              SURVIVOR
            </h1>
            <p
              className="text-yellow-400 text-xl font-bold tracking-widest uppercase"
              style={{ fontFamily: "'Clash Display', sans-serif" }}
            >
              All Ords
            </p>
          </div>
          <p className="text-green-100 text-base font-medium leading-snug">
            Pick a stock. Stay alive.
            <br />
            Last one standing wins.
          </p>

          {/* Prize callout */}
          <div
            className="w-full rounded-2xl px-5 py-4 flex items-center gap-3"
            style={{ backgroundColor: "#FFD700" }}
            data-testid="prize-callout"
          >
            <span className="text-3xl">🏆</span>
            <div className="text-left">
              <p className="font-bold text-gray-900 text-base leading-tight" style={{ fontFamily: "'Clash Display', sans-serif", letterSpacing: "0.04em" }}>
                WIN A PRIZE PACK
              </p>
              {season?.prizeName && season.prizeName !== "Prize Pack" && (
                <p className="text-gray-700 text-sm">{season.prizeName}</p>
              )}
            </div>
          </div>

          {/* CTA */}
          <Link
            href="/register"
            className="w-full block text-center font-bold text-base py-4 px-6 rounded-2xl shadow-lg hover:brightness-110 transition-all active:scale-95"
            style={{ backgroundColor: "#FFD700", color: "#005a2b", fontFamily: "'Clash Display', sans-serif", letterSpacing: "0.04em" }}
            data-testid="link-register-cta"
          >
            REGISTER TO PLAY — IT'S FREE
          </Link>

          <Link
            href="/login"
            className="text-green-200 hover:text-white text-sm underline underline-offset-2 transition-colors"
            data-testid="link-login-cta"
          >
            Already registered? Log in here.
          </Link>
        </div>
      </div>

      {/* Season status */}
      <div className="px-6 py-6 max-w-xl mx-auto w-full">
        {seasonLoading ? (
          <div className="space-y-2">
            <Skeleton className="h-5 w-32" />
            <Skeleton className="h-4 w-48" />
          </div>
        ) : season ? (
          <div
            className="rounded-2xl border border-gray-100 bg-gray-50 px-5 py-4"
            data-testid="season-status"
          >
            <div className="flex items-center gap-2 mb-1">
              <span className="inline-block h-2 w-2 rounded-full bg-green-500 animate-pulse" />
              <span className="text-xs font-semibold text-green-700 uppercase tracking-widest">
                {season.status === "registration"
                  ? "Registration Open"
                  : season.status === "active"
                  ? "Season Active"
                  : "Season Complete"}
              </span>
            </div>
            <p className="text-gray-800 font-semibold">
              Season {season.seasonNumber}
              {season.status === "active" && ` — Day ${season.currentDay}`}
            </p>
            {season.status === "active" && (
              <p className="text-gray-500 text-sm mt-0.5">
                {season.playersAlive ?? "?"} players still alive
              </p>
            )}
          </div>
        ) : (
          <div className="rounded-2xl border border-dashed border-gray-200 px-5 py-4 text-center text-gray-400 text-sm">
            No active season right now. Check back soon!
          </div>
        )}
      </div>

      {/* How to play */}
      <div className="px-6 pb-8 max-w-xl mx-auto w-full">
        <h2
          className="text-xl font-bold text-gray-900 mb-4"
          style={{ fontFamily: "'Clash Display', sans-serif" }}
        >
          How to Play
        </h2>
        <div className="space-y-3">
          {[
            {
              icon: <Target className="h-6 w-6 text-white" />,
              bg: "#00843D",
              step: "1",
              title: "Pick one ASX stock daily",
              desc: "Choose from the season's stock pool — each stock can only be used once.",
            },
            {
              icon: <TrendingUp className="h-6 w-6 text-white" />,
              bg: "#2563eb",
              step: "2",
              title: "Guess UP or DOWN",
              desc: "Predict whether your stock will close higher or lower than the open.",
            },
            {
              icon: <Skull className="h-6 w-6 text-white" />,
              bg: "#dc2626",
              step: "3",
              title: "Last player standing wins",
              desc: "Wrong guess? You're eliminated. Survive all 20 days to win the prize.",
            },
          ].map(({ icon, bg, step, title, desc }) => (
            <div
              key={step}
              className="flex items-start gap-4 rounded-xl border border-gray-100 p-4 bg-white shadow-sm"
            >
              <div
                className="flex-shrink-0 h-11 w-11 rounded-xl flex items-center justify-center shadow"
                style={{ backgroundColor: bg }}
              >
                {icon}
              </div>
              <div>
                <p className="font-bold text-gray-900 text-sm">{title}</p>
                <p className="text-gray-500 text-sm mt-0.5">{desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Footer */}
      <div className="mt-auto border-t border-gray-100 px-6 py-4 text-center">
        <Link href="/rules" className="text-sm text-gray-400 hover:text-gray-600 underline underline-offset-2" data-testid="link-rules">
          View full rules
        </Link>
        <span className="text-gray-200 mx-2">·</span>
        <Link href="/leaderboard" className="text-sm text-gray-400 hover:text-gray-600 underline underline-offset-2" data-testid="link-leaderboard-footer">
          Leaderboard
        </Link>
      </div>
    </div>
  );
}

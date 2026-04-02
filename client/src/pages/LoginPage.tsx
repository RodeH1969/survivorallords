import { useState } from "react";
import { Link, useLocation } from "wouter";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import logoPath from "@assets/logo.jpg";

export default function LoginPage() {
  const { login, isLoading } = useAuth();
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  const [mobile, setMobile] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [notFound, setNotFound] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!mobile.match(/^04\d{8}$/)) {
      setError("Please enter a valid Australian mobile number (04XXXXXXXX).");
      return;
    }

    setSubmitting(true);
    setNotFound(false);
    try {
      await login(mobile);
      toast({ title: "Welcome back! 👋", description: "You're logged in." });
      setLocation("/dashboard");
    } catch (err: any) {
      const msg = err?.message || "Login failed. Please try again.";
      // Detect "not found" / "not registered" errors
      if (msg.includes("not found") || msg.includes("404")) {
        setNotFound(true);
        setError("");
      } else {
        const match = msg.match(/^\d+:\s*(.+)/);
        const body = match ? match[1] : msg;
        try {
          const parsed = JSON.parse(body);
          setError(parsed.message || body);
        } catch {
          setError(body);
        }
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-white flex flex-col">
      {/* Header banner */}
      <div
        className="px-6 py-8 text-center"
        style={{ background: "linear-gradient(160deg, #00843D 0%, #005a2b 100%)" }}
      >
        <img
          src={logoPath}
          alt="Logo"
          className="h-16 w-16 rounded-full border-2 border-yellow-400 object-cover mx-auto mb-3"
        />
        <h1
          className="text-2xl font-bold text-white uppercase"
          style={{ fontFamily: "'Clash Display', sans-serif" }}
        >
          Log In
        </h1>
        <p className="text-green-200 text-sm mt-1">Enter your mobile number to access your account.</p>
      </div>

      {/* Form */}
      <div className="flex-1 px-6 py-8 max-w-sm mx-auto w-full">
        <form onSubmit={handleSubmit} className="space-y-5" data-testid="login-form">
          {/* Mobile */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1.5" htmlFor="mobile">
              Mobile Number
            </label>
            <input
              id="mobile"
              type="tel"
              value={mobile}
              onChange={(e) => setMobile(e.target.value.replace(/\D/g, "").slice(0, 10))}
              placeholder="04XXXXXXXX"
              className="w-full border border-gray-200 rounded-xl px-4 py-3 text-base focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
              data-testid="input-mobile"
              autoComplete="tel"
              inputMode="numeric"
            />
          </div>

          {/* Not registered state */}
          {notFound && (
            <div
              className="rounded-2xl border-2 border-amber-300 overflow-hidden"
              style={{ backgroundColor: "#FFFBEB" }}
              data-testid="not-found-message"
            >
              <div className="px-5 py-5 text-center">
                <div className="text-3xl mb-2">🤔</div>
                <p
                  className="font-bold text-amber-900 text-lg mb-1"
                  style={{ fontFamily: "'Clash Display', sans-serif" }}
                >
                  NUMBER NOT RECOGNISED
                </p>
                <p className="text-amber-700 text-sm mb-4">
                  No player is registered with this mobile number for the current season.
                </p>
                <Link
                  href="/register"
                  className="inline-block w-full py-3.5 rounded-xl font-bold text-gray-900 text-base transition-all active:scale-95 hover:brightness-110"
                  style={{
                    backgroundColor: "#FFD700",
                    fontFamily: "'Clash Display', sans-serif",
                  }}
                  data-testid="link-register-from-error"
                >
                  REGISTER TO PLAY — IT'S FREE 🎯
                </Link>
                <button
                  type="button"
                  onClick={() => { setNotFound(false); setMobile(""); }}
                  className="block w-full mt-2 text-sm text-amber-700 font-medium py-2 hover:underline"
                  data-testid="button-try-again"
                >
                  Try a different number
                </button>
              </div>
            </div>
          )}

          {/* Generic error */}
          {error && !notFound && (
            <div
              className="rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700"
              data-testid="error-message"
            >
              {error}
            </div>
          )}

          {/* Submit */}
          <button
            type="submit"
            disabled={submitting || isLoading}
            className="w-full py-4 rounded-2xl font-bold text-lg disabled:opacity-50 transition-all active:scale-95 text-white"
            style={{
              backgroundColor: "#00843D",
              fontFamily: "'Clash Display', sans-serif",
            }}
            data-testid="button-login"
          >
            {submitting ? "Logging in..." : "LOG IN →"}
          </button>
        </form>

        <p className="text-center text-sm text-gray-500 mt-6">
          Not registered yet?{" "}
          <Link href="/register" className="text-green-600 font-medium underline underline-offset-2">
            Register to play
          </Link>
        </p>
      </div>
    </div>
  );
}

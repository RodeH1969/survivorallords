import { useState } from "react";
import { Link, useLocation } from "wouter";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import logoPath from "@assets/logo.jpg";

export default function RegisterPage() {
  const { register, isLoading } = useAuth();
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  const [displayName, setDisplayName] = useState("");
  const [mobile, setMobile] = useState("");
  const [agreed, setAgreed] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [seasonClosed, setSeasonClosed] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!displayName.trim()) {
      setError("Please enter a display name.");
      return;
    }
    if (displayName.trim().length > 20) {
      setError("Display name must be 20 characters or less.");
      return;
    }
    if (!mobile.match(/^04\d{8}$/)) {
      setError("Please enter a valid Australian mobile number (04XXXXXXXX).");
      return;
    }
    if (!agreed) {
      setError("You must agree to the rules to register.");
      return;
    }

    setSubmitting(true);
    setSeasonClosed(false);
    try {
      await register(displayName.trim(), mobile);
      toast({ title: "Welcome to Survivor: All Ords! 🎉", description: "You're registered and ready to play." });
      setLocation("/dashboard");
    } catch (err: any) {
      const raw = err?.message || "Registration failed. Please try again.";
      // Detect season-closed / registration-blocked
      if (raw.includes("403") || raw.includes("closed") || raw.includes("mid-season")) {
        setSeasonClosed(true);
        setError("");
      } else {
        const match = raw.match(/^\d+:\s*(.+)/);
        const body = match ? match[1] : raw;
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
          Register to Play
        </h1>
        <p className="text-green-200 text-sm mt-1">It's free. No credit card required.</p>
      </div>

      {/* Form */}
      <div className="flex-1 px-6 py-8 max-w-sm mx-auto w-full">
        <form onSubmit={handleSubmit} className="space-y-5" data-testid="register-form">
          {/* Display name */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1.5" htmlFor="displayName">
              Display Name
            </label>
            <input
              id="displayName"
              type="text"
              maxLength={20}
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="Your game name (max 20 chars)"
              className="w-full border border-gray-200 rounded-xl px-4 py-3 text-base focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
              data-testid="input-displayname"
              autoComplete="nickname"
            />
            <p className="text-xs text-gray-400 mt-1">{displayName.length}/20 characters</p>
          </div>

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
            <p className="text-xs text-gray-400 mt-1">Australian format — 04XXXXXXXX</p>
          </div>

          {/* Rules checkbox */}
          <div className="flex items-start gap-3">
            <input
              id="agreed"
              type="checkbox"
              checked={agreed}
              onChange={(e) => setAgreed(e.target.checked)}
              className="mt-0.5 h-5 w-5 accent-green-600 flex-shrink-0"
              data-testid="checkbox-rules"
            />
            <label htmlFor="agreed" className="text-sm text-gray-600 leading-snug">
              I have read and agree to the{" "}
              <Link href="/rules" className="text-green-600 underline underline-offset-2">
                rules
              </Link>
            </label>
          </div>

          {/* Season closed */}
          {seasonClosed && (
            <div
              className="rounded-2xl border-2 border-red-300 overflow-hidden"
              style={{ backgroundColor: "#FEF2F2" }}
              data-testid="season-closed-message"
            >
              <div className="px-5 py-5 text-center">
                <div className="text-3xl mb-2">🚫</div>
                <p
                  className="font-bold text-red-900 text-lg mb-1"
                  style={{ fontFamily: "'Clash Display', sans-serif" }}
                >
                  REGISTRATION CLOSED
                </p>
                <p className="text-red-700 text-sm mb-1">
                  The current season has already started. No mid-season entries are allowed.
                </p>
                <p className="text-red-600 text-xs">
                  Come back next season — follow us to get notified when registration opens.
                </p>
              </div>
            </div>
          )}

          {/* Generic error */}
          {error && !seasonClosed && (
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
            className="w-full py-4 rounded-2xl font-bold text-lg text-gray-900 disabled:opacity-50 transition-all active:scale-95 hover:brightness-110"
            style={{
              backgroundColor: "#FFD700",
              fontFamily: "'Clash Display', sans-serif",
            }}
            data-testid="button-register"
          >
            {submitting ? "Registering..." : "JOIN THE GAME 🎯"}
          </button>
        </form>

        <p className="text-center text-sm text-gray-500 mt-6">
          Already registered?{" "}
          <Link href="/login" className="text-green-600 font-medium underline underline-offset-2">
            Log in here
          </Link>
        </p>
      </div>
    </div>
  );
}

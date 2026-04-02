import { Link } from "wouter";
import { ChevronLeft } from "lucide-react";

export default function RulesPage() {
  return (
    <div className="min-h-screen bg-white">
      {/* Header */}
      <div
        className="px-4 py-4 text-white sticky top-0 z-10"
        style={{ backgroundColor: "#00843D" }}
      >
        <div className="max-w-2xl mx-auto flex items-center gap-3">
          <Link href="/" className="p-1.5 rounded-full hover:bg-white/15 transition-colors">
            <ChevronLeft className="h-5 w-5" />
          </Link>
          <h1
            className="text-xl font-bold uppercase"
            style={{ fontFamily: "'Clash Display', sans-serif" }}
          >
            Game Rules
          </h1>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-5 py-8 prose prose-sm prose-gray" data-testid="rules-content">

        <div className="rounded-2xl bg-yellow-50 border border-yellow-200 px-5 py-4 mb-8 not-prose">
          <div className="flex items-center gap-2">
            <span className="text-2xl">🏆</span>
            <div>
              <p className="font-bold text-yellow-900" style={{ fontFamily: "'Clash Display', sans-serif" }}>
                WIN A PRIZE PACK
              </p>
              <p className="text-yellow-700 text-sm">Last player standing takes home the prize.</p>
            </div>
          </div>
        </div>

        <h2 className="text-xl font-bold" style={{ fontFamily: "'Clash Display', sans-serif" }}>1. Overview</h2>
        <p>
          <strong>Survivor: All Ords</strong> is an ASX stock prediction elimination game. Each day during the season, registered players must pick one ASX-listed stock from the season's stock pool and predict whether it will close <strong>UP</strong> or <strong>DOWN</strong> relative to its opening price for that day. Incorrect predictions result in elimination. The last player standing wins the prize.
        </p>

        <h2 className="text-xl font-bold mt-8" style={{ fontFamily: "'Clash Display', sans-serif" }}>2. Eligibility</h2>
        <ul>
          <li>Open to Australian residents aged 18 and over.</li>
          <li>One entry per person per season. You must register with a valid Australian mobile number (04XXXXXXXX format).</li>
          <li>Employees and immediate family members of the organiser and sponsors are ineligible.</li>
        </ul>

        <h2 className="text-xl font-bold mt-8" style={{ fontFamily: "'Clash Display', sans-serif" }}>3. Registration</h2>
        <ul>
          <li>Registration is free. No purchase is necessary.</li>
          <li>You must register before the season begins. Registrations close when the season is started by an administrator.</li>
          <li>Once registered, you will receive a display name that appears on the public leaderboard.</li>
        </ul>

        <h2 className="text-xl font-bold mt-8" style={{ fontFamily: "'Clash Display', sans-serif" }}>4. How Picks Work</h2>
        <ul>
          <li>Each season has a pool of 20 ASX stocks (typically ASX 20 constituents).</li>
          <li>Each day, you must pick <strong>one stock</strong> from the pool that you have <strong>not previously used</strong> in the current season.</li>
          <li>For each pick, you must also nominate a direction: <strong>UP</strong> or <strong>DOWN</strong>.</li>
          <li>Picks must be submitted between <strong>7:00am and 10:00am AEST</strong> each trading day.</li>
          <li>If you do not make a pick before 10:00am AEST, your pick will be <strong>auto-assigned</strong>: the lowest-sequence unused stock in the pool will be assigned with a direction of <strong>DOWN</strong>.</li>
          <li>You may change your pick any number of times before the 10:00am AEST cutoff, provided the pick window is open.</li>
          <li>Once the pick window closes, picks are locked and cannot be changed.</li>
        </ul>

        <h2 className="text-xl font-bold mt-8" style={{ fontFamily: "'Clash Display', sans-serif" }}>5. Results & Elimination</h2>
        <ul>
          <li>Results are processed after the market closes (typically after 4:00pm AEST).</li>
          <li>A pick is considered <strong>correct</strong> (survived) if:
            <ul>
              <li><strong>UP pick:</strong> The stock's closing price is <em>strictly greater</em> than the opening price (i.e. closing % &gt; 0%).</li>
              <li><strong>DOWN pick:</strong> The stock's closing price is <em>strictly less</em> than the opening price (i.e. closing % &lt; 0%).</li>
            </ul>
          </li>
          <li>A <strong>flat</strong> result (0% change) is treated as a loss for UP pickers and a loss for DOWN pickers. Flat = both UP and DOWN are eliminated.</li>
          <li>If your pick is incorrect, you are immediately <strong>eliminated</strong> from the season.</li>
          <li>Elimination is permanent for the current season. Eliminated players can view results and the leaderboard but cannot make further picks.</li>
        </ul>

        <h2 className="text-xl font-bold mt-8" style={{ fontFamily: "'Clash Display', sans-serif" }}>6. Winning</h2>
        <ul>
          <li>The season runs for up to <strong>20 trading days</strong>.</li>
          <li>The last player remaining after all eliminations are processed wins the prize pack.</li>
          <li>If more than one player survives all 20 days, the winner is the player who submitted their final pick earliest on Day 20.</li>
          <li>If all remaining players are eliminated on the same day with no survivors, no prize is awarded for that season.</li>
        </ul>

        <h2 className="text-xl font-bold mt-8" style={{ fontFamily: "'Clash Display', sans-serif" }}>7. Prize</h2>
        <ul>
          <li>The prize is as described on the registration page and is subject to change at the organiser's discretion.</li>
          <li>The prize is non-transferable and has no cash value.</li>
          <li>The winner will be contacted via the mobile number provided at registration.</li>
        </ul>

        <h2 className="text-xl font-bold mt-8" style={{ fontFamily: "'Clash Display', sans-serif" }}>8. Data & Privacy</h2>
        <ul>
          <li>Your mobile number is used solely to manage your entry and contact you if you win.</li>
          <li>Your display name may appear on the public leaderboard.</li>
          <li>Mobile numbers are not shared publicly or with third parties except as required by law.</li>
        </ul>

        <h2 className="text-xl font-bold mt-8" style={{ fontFamily: "'Clash Display', sans-serif" }}>9. General</h2>
        <ul>
          <li>The organiser reserves the right to amend or cancel the season at any time.</li>
          <li>The organiser's decisions regarding results, eliminations, and prize allocation are final.</li>
          <li>This game is not investment advice. Stock picks are for entertainment purposes only.</li>
          <li>By registering, you confirm that you have read and agree to these rules.</li>
        </ul>

        <div className="mt-10 pt-6 border-t border-gray-100 text-center not-prose">
          <Link
            href="/register"
            className="inline-block py-4 px-8 rounded-2xl font-bold text-gray-900 text-base transition-all hover:brightness-110 active:scale-95"
            style={{
              backgroundColor: "#FFD700",
              fontFamily: "'Clash Display', sans-serif",
            }}
            data-testid="link-register-from-rules"
          >
            REGISTER TO PLAY — IT'S FREE
          </Link>
        </div>
      </div>
    </div>
  );
}

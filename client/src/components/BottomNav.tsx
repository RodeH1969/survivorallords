import { Link, useLocation } from "wouter";
import { Home, Target, BarChart3, Trophy } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { cn } from "@/lib/utils";

const navItems = [
  { href: "/dashboard", label: "Dashboard", icon: Home },
  { href: "/pick", label: "Pick", icon: Target },
  { href: "/results", label: "Results", icon: BarChart3 },
  { href: "/leaderboard", label: "Leaderboard", icon: Trophy },
];

export default function BottomNav() {
  const [location] = useLocation();
  const { isLoggedIn } = useAuth();

  // Only show bottom nav for logged-in users (or on public pages like results/leaderboard)
  const showOnPublic = location.startsWith("/results") || location.startsWith("/leaderboard");
  if (!isLoggedIn && !showOnPublic) return null;

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-50 border-t border-gray-200 bg-white"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      data-testid="bottom-nav"
    >
      <div className="flex max-w-2xl mx-auto">
        {navItems.map(({ href, label, icon: Icon }) => {
          const isActive = location === href || location.startsWith(href + "/");
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                "flex flex-1 flex-col items-center justify-center py-2 gap-0.5 transition-colors",
                isActive
                  ? "text-[#00843D]"
                  : "text-gray-400 hover:text-gray-600"
              )}
              data-testid={`nav-${label.toLowerCase()}`}
            >
              <Icon className={cn("h-5 w-5", isActive && "stroke-[2.5]")} />
              <span className={cn("text-[10px] font-medium", isActive && "font-semibold")}>
                {label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

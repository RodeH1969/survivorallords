import { Link, useLocation } from "wouter";
import { LogOut, Shield } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import logoPath from "@assets/logo.jpg";

export default function Header() {
  const { isLoggedIn, logout, player } = useAuth();
  const [, setLocation] = useLocation();

  const handleLogout = () => {
    logout();
    setLocation("/");
  };

  return (
    <header
      className="sticky top-0 z-50 w-full"
      style={{ backgroundColor: "#00843D" }}
      data-testid="header"
    >
      <div className="flex items-center justify-between px-4 py-3 max-w-2xl mx-auto">
        {/* Logo + Title */}
        <Link href="/" className="flex items-center gap-2">
          <img
            src={logoPath}
            alt="Survivor: All Ords Logo"
            className="h-9 w-9 rounded-full object-cover border-2 border-yellow-400"
            data-testid="header-logo"
          />
          <span
            className="text-white font-bold text-base leading-tight tracking-wide"
            style={{ fontFamily: "'Clash Display', sans-serif" }}
          >
            Survivor: All Ords
          </span>
        </Link>

        {/* Actions */}
        <div className="flex items-center gap-2">
          {isLoggedIn ? (
            <>
              <span className="text-green-100 text-sm hidden sm:block">
                {player?.displayName}
              </span>
              <button
                onClick={handleLogout}
                className="flex items-center gap-1.5 bg-white/15 hover:bg-white/25 text-white text-sm px-3 py-1.5 rounded-full transition-colors"
                data-testid="button-logout"
              >
                <LogOut className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Log out</span>
              </button>
            </>
          ) : (
            <>
              <Link
                href="/login"
                className="text-white/80 hover:text-white text-sm transition-colors"
                data-testid="link-login"
              >
                Log in
              </Link>
              <Link
                href="/register"
                className="bg-yellow-400 hover:bg-yellow-300 text-gray-900 font-semibold text-sm px-3 py-1.5 rounded-full transition-colors"
                data-testid="link-register"
              >
                Register
              </Link>
            </>
          )}
          <Link
            href="/admin"
            className="flex items-center gap-1 bg-white/10 hover:bg-white/20 text-white/70 hover:text-white text-xs px-2.5 py-1.5 rounded-full transition-colors"
            data-testid="link-admin"
          >
            <Shield className="h-3 w-3" />
            <span className="hidden sm:inline">Admin</span>
          </Link>
        </div>
      </div>
    </header>
  );
}

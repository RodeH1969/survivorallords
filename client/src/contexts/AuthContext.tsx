import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from "react";
import { apiRequest, setSessionToken, queryClient, getApiBase } from "@/lib/queryClient";
import type { Player, Season } from "@shared/schema";

interface MeResponse {
  player: Player;
  season: Season;
  todayPick: any | null;
  usedStocks: string[];
}

interface AuthContextType {
  sessionToken: string | null;
  player: Player | null;
  season: Season | null;
  todayPick: any | null;
  usedStocks: string[];
  isLoggedIn: boolean;
  isLoading: boolean;
  login: (mobile: string) => Promise<void>;
  register: (displayName: string, mobile: string) => Promise<void>;
  logout: () => void;
  refetch: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [sessionToken, setTokenState] = useState<string | null>(null);
  const [player, setPlayer] = useState<Player | null>(null);
  const [season, setSeason] = useState<Season | null>(null);
  const [todayPick, setTodayPick] = useState<any | null>(null);
  const [usedStocks, setUsedStocks] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const setToken = useCallback((token: string | null) => {
    setTokenState(token);
    setSessionToken(token);
  }, []);

  const fetchMe = useCallback(async (token: string) => {
    setIsLoading(true);
    try {
      const res = await fetch(`${getApiBase()}/api/me`, {
        headers: { "x-session-token": token },
      });
      if (!res.ok) {
        setToken(null);
        setPlayer(null);
        setSeason(null);
        return;
      }
      const data: MeResponse = await res.json();
      setPlayer(data.player);
      setSeason(data.season);
      setTodayPick(data.todayPick);
      setUsedStocks(data.usedStocks);
    } catch {
      setToken(null);
      setPlayer(null);
      setSeason(null);
    } finally {
      setIsLoading(false);
    }
  }, [setToken]);

  const refetch = useCallback(async () => {
    if (sessionToken) {
      await fetchMe(sessionToken);
      queryClient.invalidateQueries({ queryKey: ["/api/me"] });
    }
  }, [sessionToken, fetchMe]);

  const login = useCallback(async (mobile: string) => {
    const res = await apiRequest("POST", "/api/login", { mobile });
    const data = await res.json();
    setToken(data.sessionToken);
    await fetchMe(data.sessionToken);
  }, [setToken, fetchMe]);

  const register = useCallback(async (displayName: string, mobile: string) => {
    const res = await apiRequest("POST", "/api/register", { displayName, mobile });
    const data = await res.json();
    setToken(data.sessionToken);
    await fetchMe(data.sessionToken);
  }, [setToken, fetchMe]);

  const logout = useCallback(() => {
    setToken(null);
    setPlayer(null);
    setSeason(null);
    setTodayPick(null);
    setUsedStocks([]);
    queryClient.clear();
  }, [setToken]);

  return (
    <AuthContext.Provider
      value={{
        sessionToken,
        player,
        season,
        todayPick,
        usedStocks,
        isLoggedIn: !!player,
        isLoading,
        login,
        register,
        logout,
        refetch,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}

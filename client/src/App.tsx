import { Switch, Route, Router } from "wouter";
import { useHashLocation } from "wouter/use-hash-location";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/contexts/AuthContext";
import NotFound from "@/pages/not-found";

import Header from "@/components/Header";
import BottomNav from "@/components/BottomNav";
import LandingPage from "@/pages/LandingPage";
import RegisterPage from "@/pages/RegisterPage";
import LoginPage from "@/pages/LoginPage";
import DashboardPage from "@/pages/DashboardPage";
import PickPage from "@/pages/PickPage";
import ResultsPage from "@/pages/ResultsPage";
import LeaderboardPage from "@/pages/LeaderboardPage";
import RulesPage from "@/pages/RulesPage";
import AdminPage from "@/pages/AdminPage";

function AppRouter() {
  return (
    <Switch>
      <Route path="/" component={LandingPage} />
      <Route path="/register" component={RegisterPage} />
      <Route path="/login" component={LoginPage} />
      <Route path="/dashboard" component={DashboardPage} />
      <Route path="/pick" component={PickPage} />
      <Route path="/results" component={ResultsPage} />
      <Route path="/leaderboard" component={LeaderboardPage} />
      <Route path="/rules" component={RulesPage} />
      <Route path="/admin" component={AdminPage} />
      <Route component={NotFound} />
    </Switch>
  );
}

// Pages that show the shared Header/BottomNav (exclude admin, landing, register, login, rules)
function useShowSharedLayout() {
  const [location] = useHashLocation();
  const noLayoutPages = ["/admin"];
  return !noLayoutPages.some((p) => location === p || location.startsWith(p + "/"));
}

function LayoutWrapper({ children }: { children: React.ReactNode }) {
  const showLayout = useShowSharedLayout();
  return (
    <>
      {showLayout && <Header />}
      {children}
      {showLayout && <BottomNav />}
    </>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Router hook={useHashLocation}>
          <AuthProvider>
            <LayoutWrapper>
              <AppRouter />
            </LayoutWrapper>
          </AuthProvider>
        </Router>
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;

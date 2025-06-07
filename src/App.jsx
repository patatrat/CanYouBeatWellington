
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, useLocation } from "react-router-dom";
import { useEffect } from "react";
import { navItems } from "./nav-items";
import { trackPageView } from "./utils/analytics";

const queryClient = new QueryClient();

// Component to track page views
const Analytics = () => {
  const location = useLocation();

  useEffect(() => {
    const currentNavItem = navItems.find(item => item.to === location.pathname);
    const pageTitle = currentNavItem ? currentNavItem.title : 'Page';
    trackPageView(window.location.href, `${pageTitle} - Can You Beat Wellington`);
  }, [location]);

  return null;
};

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <BrowserRouter>
        <Analytics />
        <Routes>
          {navItems.map(({ to, page }) => (
            <Route key={to} path={to} element={page} />
          ))}
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;

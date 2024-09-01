import { HomeIcon, SettingsIcon } from "lucide-react";
import Index from "./pages/Index.jsx";
import Admin from "./pages/Admin.jsx";

export const navItems = [
  {
    title: "Home",
    to: "/",
    icon: <HomeIcon className="h-4 w-4" />,
    page: <Index />,
  },
  {
    title: "Admin",
    to: "/admin",
    icon: <SettingsIcon className="h-4 w-4" />,
    page: <Admin />,
  },
];
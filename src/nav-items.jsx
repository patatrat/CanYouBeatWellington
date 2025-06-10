
import { HomeIcon, InfoIcon, UserIcon, FileTextIcon, DownloadIcon, BarChart3Icon } from "lucide-react";
import Index from "./pages/Index.jsx";
import About from "./pages/About.jsx";
import Admin from "./pages/Admin.jsx";
import CSVGen from "./pages/CSVGen.jsx";
import DataExplorer from "./pages/DataExplorer.jsx";

/**
 * Central place for defining the navigation items. Used for navigation components and routing.
 */
export const navItems = [
  {
    title: "Home",
    to: "/",
    icon: <HomeIcon className="h-4 w-4" />,
    page: <Index />,
  },
  {
    title: "About",
    to: "/about",
    icon: <InfoIcon className="h-4 w-4" />,
    page: <About />,
  },
  {
    title: "Admin",
    to: "/admin",
    icon: <UserIcon className="h-4 w-4" />,
    page: <Admin />,
  },
  {
    title: "CSV Generator",
    to: "/csv-gen",
    icon: <DownloadIcon className="h-4 w-4" />,
    page: <CSVGen />,
  },
  {
    title: "Data Explorer",
    to: "/data-explorer",
    icon: <BarChart3Icon className="h-4 w-4" />,
    page: <DataExplorer />,
  },
];

import type { RouteObject } from "react-router";
import { AppLayout } from "./components/AppLayout";
import { ComparePage } from "./pages/ComparePage";
import { DashboardPage } from "./pages/DashboardPage";
import { NotFoundPage } from "./pages/NotFoundPage";
import { ResearchPage } from "./pages/ResearchPage";
import { UploadPage } from "./pages/UploadPage";

/** Pages in navigation order. The nav and the router both read this list. */
export const NAV_ITEMS = [
  { path: "/", label: "Dashboard" },
  { path: "/compare", label: "Compare" },
  { path: "/research", label: "Research" },
  { path: "/upload", label: "Upload" },
] as const;

export const routes: RouteObject[] = [
  {
    path: "/",
    element: <AppLayout />,
    children: [
      { index: true, element: <DashboardPage /> },
      { path: "compare", element: <ComparePage /> },
      { path: "research", element: <ResearchPage /> },
      { path: "upload", element: <UploadPage /> },
      { path: "*", element: <NotFoundPage /> },
    ],
  },
];

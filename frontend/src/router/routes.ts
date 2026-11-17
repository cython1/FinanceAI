import type { RouteRecordRaw } from "vue-router";
import AppLayout from "@/components/AppLayout.vue";
import DashboardView from "@/views/DashboardView.vue";

/** Pages in navigation order. The nav and the router both read this list. */
export const NAV_ITEMS = [
  { name: "dashboard", path: "/", label: "Dashboard" },
  { name: "compare", path: "/compare", label: "Compare" },
  { name: "research", path: "/research", label: "Research" },
  { name: "upload", path: "/upload", label: "Upload" },
] as const;

export const routes: RouteRecordRaw[] = [
  {
    path: "/",
    component: AppLayout,
    children: [
      { path: "", name: "dashboard", component: DashboardView },
      // Other pages load on first visit (code splitting).
      { path: "compare", name: "compare", component: () => import("@/views/CompareView.vue") },
      { path: "research", name: "research", component: () => import("@/views/ResearchView.vue") },
      { path: "upload", name: "upload", component: () => import("@/views/UploadView.vue") },
      {
        path: ":pathMatch(.*)*",
        name: "not-found",
        component: () => import("@/views/NotFoundView.vue"),
      },
    ],
  },
];

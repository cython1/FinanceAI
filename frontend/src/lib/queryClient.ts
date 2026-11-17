import { QueryClient } from "@tanstack/react-query";

/** Server-state cache for API calls (FAI-029 adds the typed fetchers). */
export function createQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 30_000, // KPI data changes only when a report is ingested
        retry: 1,
        refetchOnWindowFocus: false,
      },
    },
  });
}

# frontend

The FinanceAI web app: React 19, TypeScript, Vite, React Router and TanStack Query. It talks only to `node-api`.

## Setup

```bash
cd frontend
npm ci
npm run dev        # http://localhost:5173
```

Requires Node.js 22.22 or newer.

## Pages

| Route       | Page                                         | Ticket  |
| ----------- | -------------------------------------------- | ------- |
| `/`         | Dashboard: KPI cards per company             | FAI-030 |
| `/compare`  | Compare companies: revenue and profit trends | FAI-031 |
| `/research` | Research: questions with cited answers       | FAI-032 |
| `/upload`   | Upload a report and follow its status        | FAI-033 |

Routes and the nav both come from [`src/routes.tsx`](src/routes.tsx); add a page there once and it appears in both. Unknown paths show a not-found page.

## Configuration

Vite reads `VITE_*` variables from the **repo-root `.env`** (`envDir: ".."`), the same file the other services use. The frontend needs:

| Variable            | Meaning                                                         |
| ------------------- | --------------------------------------------------------------- |
| `VITE_API_BASE_URL` | node-api as seen from the browser, e.g. `http://localhost:3000` |

`VITE_*` values are compiled into the JavaScript the browser downloads, so never put a key or secret in one.

## Structure

| Path                           | Contents                                                  |
| ------------------------------ | --------------------------------------------------------- |
| `src/main.tsx`                 | Entry: router and TanStack Query providers                |
| `src/routes.tsx`               | Route table and nav items                                 |
| `src/components/AppLayout.tsx` | Header, nav and page outlet                               |
| `src/pages/`                   | One component per page (placeholders until their tickets) |
| `src/lib/queryClient.ts`       | TanStack Query defaults                                   |

Styling is plain CSS for now; the styling approach (UI library or not) is still to be decided.

## Checks

```bash
npm run lint
npm run format:check
npm run typecheck
npm test
npm run build
```

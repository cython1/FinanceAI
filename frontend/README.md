# frontend

The FinanceAI web app: Vue 3, TypeScript, Vite, Vue Router and Pinia. It talks only to `node-api`.

## Setup

```bash
cd frontend
npm ci
npm run dev        # http://localhost:5173
```

Requires Node.js 22.18 or newer.

## Pages

| Route       | Page                                         | Ticket  |
| ----------- | -------------------------------------------- | ------- |
| `/`         | Dashboard: KPI cards per company             | FAI-030 |
| `/compare`  | Compare companies: revenue and profit trends | FAI-031 |
| `/research` | Research: questions with cited answers       | FAI-032 |
| `/upload`   | Upload a report and follow its status        | FAI-033 |

Routes and nav items live in [`src/router/routes.ts`](src/router/routes.ts). Add a page there and add its nav entry to `NAV_ITEMS`. Unknown paths show a not-found page. Pages other than the dashboard are lazy-loaded.

## Configuration

Vite reads `VITE_*` variables from the **repo-root `.env`** (`envDir: ".."`), the same file the other services use. The frontend needs:

| Variable            | Meaning                                                         |
| ------------------- | --------------------------------------------------------------- |
| `VITE_API_BASE_URL` | node-api as seen from the browser, e.g. `http://localhost:3000` |

`VITE_*` values are compiled into the JavaScript the browser downloads, so never put a key or secret in one.

## Structure

| Path                           | Contents                                                  |
| ------------------------------ | --------------------------------------------------------- |
| `src/main.ts`                  | Entry: installs Pinia and the router                      |
| `src/router/routes.ts`         | Route table and nav items                                 |
| `src/router/index.ts`          | Router with browser history                               |
| `src/components/AppLayout.vue` | Header, nav and page outlet                               |
| `src/views/`                   | One component per page (placeholders until their tickets) |
| `src/stores/`                  | Pinia stores (none yet)                                   |
| `src/__tests__/`               | Vitest + Vue Test Utils tests                             |

Still to decide: how server data is fetched and cached (Pinia stores or TanStack Vue Query), and the styling approach (UI library or not). Styling is plain CSS for now.

## Checks

```bash
npm run lint
npm run format:check
npm run typecheck
npm test
npm run build
```

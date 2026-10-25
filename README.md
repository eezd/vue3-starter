# Vue3 Demo

A general frontend starter simplified from V3 Admin Vite, using Vue 3, TypeScript, Vite, Element Plus, Pinia, Vue Router, Axios and UnoCSS.

## Included

- Login with captcha, persistent bearer token, current-user loading and return navigation.
- Role/permission-filtered routes, a permission directive and permission checks.
- A minimal home page, one permission example and 403/404 pages.
- Small pagination, async select, fullscreen loading and page-title composables.

Async selects expose the original loading failure through `error`, distinguishing failure from a successful empty list; the HTTP layer owns request notifications.
The loading wrapper preserves operation results and errors. A shared fullscreen instance stays open until all associated calls finish.

The starter has no admin shell, sidebar, tabs, layout settings, theme switching, promotional notifications or CRUD showcase. Registration is not implemented.

## Development

Use a Node.js version supported by Vite 7 (20.19+ or 22.12+; prefer a supported, patched LTS) and pnpm.
Verified with Node.js 24.22.1 and pnpm 12.11.2. `pnpm-workspace.yaml` permits install-time build scripts only for the existing `esbuild` and `@parcel/watcher` dependencies.

```bash
pnpm install --frozen-lockfile
pnpm dev
pnpm lint:check
pnpm test --run
pnpm build
pnpm build:staging
pnpm preview
```

`pnpm lint` applies fixes; `lint:check` is read-only. The default development port is 3333.

## Backend integration

No backend, remote demo service or fake login is included. API requests default to same-origin `/api/v1` in every mode.
For a separate development backend, create the ignored `.env.development.local`:

```dotenv
VITE_PROXY_TARGET=http://127.0.0.1:8080
```

The proxy forwards `/api/v1` without rewriting it. Without a proxy, the current origin must serve the API. Set `VITE_BASE_URL` for your actual deployment if needed.
Never store secrets in `VITE_*` variables; they are public frontend configuration. `VITE_PROXY_TARGET` is read by the development server.

Responses follow `{ code, data, message }`, with `code: 0` for success. Authenticated requests carry `Authorization: Bearer <token>`.

| Endpoint                   | Request                        | Successful data                                                 |
| -------------------------- | ------------------------------ | --------------------------------------------------------------- |
| `GET /api/v1/auth/captcha` | None                           | Image URL or data URL string                                    |
| `POST /api/v1/auth/login`  | `{ username, password, code }` | `{ token: string }`                                             |
| `GET /api/v1/users/me`     | Bearer token                   | `{ username: string, roles: string[], permissions?: string[] }` |

Adapt API modules, types and callers together when connecting a different backend. Password policy belongs to the backend; no demo credentials are prefilled.
HTTP 401 and business code 401 for the current session clear authentication and dynamic routes, redirect to login and reject the request.
After logout or a new login, outdated requests reject as Axios cancellations without overwriting the new identity, showing old errors or logging out the new session. Explicit cancellations also produce no error notification.

The home route is `/dashboard`. `/permission` requires the `admin` role OR `permission:page-level` permission. Unregistered dynamic routes resolve to 404.
Frontend permissions only control navigation and presentation; the backend must enforce authorization.
Without a backend, the login page renders but captcha and login cannot succeed. Do not replace missing backend functionality with fake authentication.

## Project rules

Read [AGENTS.md](./AGENTS.md) before developing. Keep private APIs, components, composables, types and assets inside `src/pages/<module>/`; move genuinely shared code to `src/common/`.
Shared state lives in `src/pinia/`, routing in `src/router/`, HTTP handling in `src/http/`, and ambient declarations in `types/`.
Vite plugins generate `types/auto/`; regenerate through the dev server or a build before checking a fresh checkout, and do not edit generated declarations by hand.

CLAUDE, Cursor and Trae entrypoints refer to AGENTS.md. The five `.agents/skills/v3-*` skills describe the actual CRUD, routing, store, composable and utility workflows.
Mock responses are restricted to tests. See [中文说明](./README.zh-CN.md) for the Chinese guide.

## License

Adapted from [V3 Admin Vite](https://github.com/un-pany/v3-admin-vite). The original [MIT LICENSE](./LICENSE) is preserved.

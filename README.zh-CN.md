# Vue3 Demo

一个从 V3 Admin Vite 精简的通用前端起步模板，使用 Vue 3、TypeScript、Vite、Element Plus、Pinia、Vue Router、Axios 和 UnoCSS。

## 保留能力

- 登录、验证码、Token 持久化、用户信息加载和登录回跳。
- 基于角色或权限的动态路由、权限指令与权限判断函数。
- 最小首页、一个权限示例、403/404 页面。
- 分页、异步下拉、全屏加载、动态标题等小型通用能力。

异步下拉通过 `error` 保留加载失败的原始异常，和成功空列表区分；请求层负责错误提示。

不预置后台侧栏、标签页、布局设置、多主题、推广通知或业务 CRUD 演示；当前没有注册功能。

## 开发

使用受 Vite 7 支持的 Node.js（20.19+ 或 22.12+，推荐仍受支持的 LTS 补丁版本）和 pnpm。
本次验证环境为 Node.js 24.22.1、pnpm 12.11.2；`pnpm-workspace.yaml` 只允许现有 `esbuild`、`@parcel/watcher` 执行安装构建脚本。

```bash
pnpm install --frozen-lockfile
pnpm dev
pnpm lint:check
pnpm test --run
pnpm build
pnpm build:staging
pnpm preview
```

`pnpm lint` 会自动修复；`lint:check` 只检查。端口默认为 3333。

## 接入后端

模板不包含后端，也不使用远程演示服务或本地假登录。所有环境默认请求同源 `/api/v1`。
开发时可在忽略的 `.env.development.local` 中配置实际后端：

```dotenv
VITE_PROXY_TARGET=http://127.0.0.1:8080
```

代理原样转发 `/api/v1` 路径，不重写；没有代理时由当前站点提供接口。部署时也可按实际跨域方案调整 `VITE_BASE_URL`。
`VITE_*` 会暴露给前端，不得放密钥；`VITE_PROXY_TARGET` 只供 Vite 开发代理读取。

接口使用 `{ code, data, message }`，`code: 0` 表示成功；请求携带 `Authorization: Bearer <token>`。

| 接口                       | 请求                           | 成功响应中的 data                                               |
| -------------------------- | ------------------------------ | --------------------------------------------------------------- |
| `GET /api/v1/auth/captcha` | 无                             | 验证码图片 URL 或 data URL 字符串                               |
| `POST /api/v1/auth/login`  | `{ username, password, code }` | `{ token: string }`                                             |
| `GET /api/v1/users/me`     | Bearer Token                   | `{ username: string, roles: string[], permissions?: string[] }` |

以上是继承的模板契约；接入不同后端时同步修改对应 API、类型及调用方。登录密码不预设演示长度限制，具体规则由后端决定。
当前会话的 HTTP 401 或业务 code 401 会清空认证、移除动态路由、跳转登录页，并使请求失败。
退出或重新登录后，旧请求按 Axios 取消语义拒绝，不覆盖新身份、不提示旧错误或注销新会话；主动取消同样不弹错误。

默认首页为 `/dashboard`；`/permission` 要求 `admin` 角色或 `permission:page-level` 权限。
未授权动态路径不会注册，访问时进入 404。前端权限只控制展示，后端仍必须检查接口权限。
未接入后端时，登录页可显示，但验证码和登录不能成功；不要把这种情况改成假登录。

## 文件归属与 AI 开发

先读 [AGENTS.md](./AGENTS.md)。业务代码放 `src/pages/<module>/`，私有 API、组件、组合函数、资源跟随页面；实际共享内容才进入 `src/common/`。
认证状态位于 `src/pinia/`，路由位于 `src/router/`，请求处理位于 `src/http/`，框架与全局声明位于 `types/`。
`types/auto/` 由 Vite 插件生成，禁止手工修改；首次检查前运行开发服务或构建以刷新声明。

CLAUDE、Cursor、Trae 的规则入口统一指向 AGENTS.md；五个 `.agents/skills/v3-*` 技能分别指导 CRUD、路由、store、组合函数和工具使用。
技能只提供当前模板能力，不要求生成后台布局或没有需求的抽象。测试使用的模拟响应仅位于测试中。

## 许可

基于 [V3 Admin Vite](https://github.com/un-pany/v3-admin-vite) 精简，保留原 [MIT LICENSE](./LICENSE)。

---
name: v3-upsert-route
description: 为本项目新增或调整页面路由、登录白名单和角色/权限路由；适用于导航与访问控制变更。
---

# 路由

先读 AGENTS.md 的认证与权限契约，以及 `src/router/` 和 permission store 的实际实现。

- 常驻路由放 constantRoutes，按角色或权限控制的页面放 dynamicRoutes。常驻不等于允许匿名访问，匿名页面必须显式加入 whitelist。
- 路由直接使用 `() => import("@/pages/<module>/index.vue")`，name 必须唯一；不要添加后台布局、菜单、标签页或缓存降级字段。
- 保留的 meta 为 title、roles、permissions；title 用于页面标题，roles 与 permissions 满足其一即可访问。
- roles/permissions 未声明表示不限制该层权限；空数组表示没有匹配项。子路由受父级过滤结果影响。
- 需要嵌套页面时，父页面显式提供 router-view；只是逻辑分组时不添加占位组件。有默认子页时 redirect 指向实际存在的路由。
- 动态路由注册和清理沿用现有实现，检查退出登录、认证失效及换用户后不残留权限。
- 未注册或无权加载的路径进入 404；403 是保留的错误展示页。前端权限不代替后端授权。

示例（权限值必须来自需求或后端）：

```ts
{
  path: "/reports",
  name: "Reports",
  component: () => import("@/pages/reports/index.vue"),
  meta: { title: "报表", permissions: ["reports:read"] }
}
```

验证匿名跳转、登录回跳、允许/拒绝访问、深链刷新和注销后的动态路由清理，再运行相关测试及构建。

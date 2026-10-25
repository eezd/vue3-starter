import type { RouteRecordRaw } from "vue-router"
import { DASHBOARD_PATH } from "./config"

/** 常驻页面仍需通过登录守卫，匿名访问由白名单决定。 */
export const constantRoutes: RouteRecordRaw[] = [
  { path: "/", redirect: DASHBOARD_PATH },
  {
    path: "/login",
    name: "Login",
    component: () => import("@/pages/login/index.vue"),
    meta: { title: "登录" }
  },
  {
    path: DASHBOARD_PATH,
    name: "Dashboard",
    component: () => import("@/pages/dashboard/index.vue"),
    meta: { title: "首页" }
  },
  {
    path: "/403",
    name: "Forbidden",
    component: () => import("@/pages/error/403.vue"),
    meta: { title: "访问受限" }
  },
  {
    path: "/404",
    name: "NotFound",
    component: () => import("@/pages/error/404.vue"),
    alias: "/:pathMatch(.*)*",
    meta: { title: "页面不存在" }
  }
]

/** 按当前用户角色或权限筛选后注册；注销时按名称移除。 */
export const dynamicRoutes: RouteRecordRaw[] = [
  {
    path: "/permission",
    name: "Permission",
    component: () => import("@/pages/permission/index.vue"),
    meta: {
      title: "权限示例",
      roles: ["admin"],
      permissions: ["permission:page-level"]
    }
  }
]

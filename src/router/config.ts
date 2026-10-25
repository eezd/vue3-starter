import type { RouterHistory } from "vue-router"
import { createWebHashHistory, createWebHistory } from "vue-router"

/** 路由配置 */
interface RouterConfig {
  /**
   * @name 路由模式
   * @description hash 模式和 html5 模式
   */
  history: RouterHistory
  /**
   * @name 是否开启动态路由功能
   * @description 1. 开启后需要后端配合，在查询用户详情接口返回当前用户可以用来判断并加载动态路由的字段（roles / permissions）
   * @description 2. 假如项目不需要根据不同的用户来显示不同的页面，则应该将 dynamic: false
   */
  dynamic: boolean
}

const VITE_ROUTER_HISTORY = import.meta.env.VITE_ROUTER_HISTORY

const VITE_PUBLIC_PATH = import.meta.env.VITE_PUBLIC_PATH

export const DASHBOARD_PATH = "/dashboard"

export const routerConfig: RouterConfig = {
  history: VITE_ROUTER_HISTORY === "hash" ? createWebHashHistory(VITE_PUBLIC_PATH) : createWebHistory(VITE_PUBLIC_PATH),
  dynamic: true
}

import type { Router } from "vue-router"
import { useTitle } from "@@/composables/useTitle"
import { getToken } from "@@/utils/local-storage"
import { isCancel } from "axios"
import NProgress from "nprogress"
import { usePermissionStore } from "@/pinia/stores/permission"
import { useUserStore } from "@/pinia/stores/user"
import { routerConfig } from "@/router/config"
import { isWhiteList } from "@/router/whitelist"

NProgress.configure({ showSpinner: false })

const { setTitle } = useTitle()

const LOGIN_PATH = "/login"

export function registerNavigationGuard(router: Router) {
  // 全局前置守卫
  router.beforeEach(async (to, _from) => {
    NProgress.start()
    const userStore = useUserStore()
    const permissionStore = usePermissionStore()
    // 如果没有登录
    if (!getToken()) {
      // 如果在免登录的白名单中，则直接进入
      if (isWhiteList(to)) return true
      // 其他没有访问权限的页面将被重定向到登录页面
      return { path: LOGIN_PATH, query: { redirect: to.fullPath } }
    }
    // 如果已经登录，并准备进入 Login 页面，则重定向到主页
    if (to.path === LOGIN_PATH) return "/"
    // 如果用户已经获得其权限信息
    if (userStore.isGotUserInfo) return true
    // 否则要重新获取权限信息
    const version = userStore.getSessionVersion()
    try {
      await userStore.getInfo()
      if (version !== userStore.getSessionVersion()) return false
      // 注意：角色和权限必须是数组！ 例如: ["admin"] 或 ["permission:page-level"]
      const { roles, permissions } = userStore
      // 生成可访问的 Routes
      routerConfig.dynamic ? permissionStore.setRoutes({ roles, permissions }) : permissionStore.setAllRoutes()
      // 将 "有访问权限的动态路由" 添加到 Router 中
      permissionStore.addRoutes.forEach(route => router.addRoute(route))
      // 设置 replace: true, 因此导航将不会留下历史记录
      // 首次匹配可能落在 404，按路径重匹配，不能沿用旧 name/params。
      return { path: to.path, query: to.query, hash: to.hash, replace: true }
    } catch (error) {
      // 旧导航或主动取消不能清理已经开始的新会话。
      if (isCancel(error) || version !== userStore.getSessionVersion()) return false
      userStore.resetToken()
      return LOGIN_PATH
    }
  })

  // 全局后置钩子
  router.afterEach((to) => {
    setTitle(to.meta.title)
    NProgress.done()
  })

  router.onError(() => NProgress.done())
}

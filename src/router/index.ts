import { createRouter } from "vue-router"
import { routerConfig } from "./config"
import { registerNavigationGuard } from "./guard"
import { constantRoutes, dynamicRoutes } from "./routes"

export const router = createRouter({
  history: routerConfig.history,
  routes: constantRoutes
})

/** 移除动态路由根记录时，Vue Router 同时移除其子路由。 */
export function resetRouter() {
  for (const route of dynamicRoutes) {
    if (route.name && router.hasRoute(route.name)) {
      router.removeRoute(route.name)
    }
  }
}

registerNavigationGuard(router)

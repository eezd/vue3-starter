import type { RouteRecordRaw } from "vue-router"
import { dynamicRoutes } from "@/router/routes"

interface UserPermissionInfo {
  roles: string[]
  permissions: string[]
}

function hasPermission(userPermissionInfo: UserPermissionInfo, route: RouteRecordRaw) {
  const routeRoles = route.meta?.roles
  const routePermissions = route.meta?.permissions
  const hasRoles = routeRoles !== undefined
  const hasPermissions = routePermissions !== undefined
  if (!hasRoles && !hasPermissions) return true
  const matchedRole = routeRoles?.some(role => userPermissionInfo.roles.includes(role)) ?? false
  const matchedPermission = routePermissions?.some(permission => userPermissionInfo.permissions.includes(permission)) ?? false
  return matchedRole || matchedPermission
}

function filterDynamicRoutes(routes: RouteRecordRaw[], userPermissionInfo: UserPermissionInfo) {
  const res: RouteRecordRaw[] = []
  routes.forEach((route) => {
    const tempRoute = { ...route }
    if (hasPermission(userPermissionInfo, tempRoute)) {
      if (tempRoute.children) {
        tempRoute.children = filterDynamicRoutes(tempRoute.children, userPermissionInfo)
        if (tempRoute.children.length === 0) return
      }
      res.push(tempRoute)
    }
  })
  return res
}

export const usePermissionStore = defineStore("permission", () => {
  // 有访问权限的动态路由
  const addRoutes = ref<RouteRecordRaw[]>([])

  // 根据角色和权限筛选动态路由，常驻路由由 Router 单独注册。
  const setRoutes = (userPermissionInfo: UserPermissionInfo) => {
    const accessedRoutes = filterDynamicRoutes(dynamicRoutes, userPermissionInfo)
    addRoutes.value = accessedRoutes
  }

  // 关闭动态权限筛选时使用全部动态路由。
  const setAllRoutes = () => {
    addRoutes.value = dynamicRoutes
  }

  const resetRoutes = () => {
    addRoutes.value = []
  }

  return { addRoutes, setRoutes, setAllRoutes, resetRoutes }
})

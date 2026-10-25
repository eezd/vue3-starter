import { getCurrentUserApi } from "@@/apis/users"
import { setToken as _setToken, getToken, removeToken } from "@@/utils/local-storage"
import { CanceledError } from "axios"
import { resetRouter, router } from "@/router"
import { usePermissionStore } from "./permission"

export const useUserStore = defineStore("user", () => {
  // Token 可能复用，使用会话代号区分退出后重新登录的异步结果。
  let sessionVersion = 0
  const getSessionVersion = () => sessionVersion

  const token = ref<string>(getToken() || "")

  const roles = ref<string[]>([])

  const permissions = ref<string[]>([])

  const username = ref<string>("")

  const isGotUserInfo = ref<boolean>(false)

  // 设置 Token
  const setToken = (value: string) => {
    resetToken()
    _setToken(value)
    token.value = value
  }

  // 获取用户详情
  const getInfo = async () => {
    const version = sessionVersion
    const { data } = await getCurrentUserApi()
    if (version !== sessionVersion) throw new CanceledError("会话已变化")
    // 用户信息是权限边界；必需字段错误时拒绝登录，不伪造空角色。
    if (!data || typeof data.username !== "string"
      || !Array.isArray(data.roles) || data.roles.some(role => typeof role !== "string")
      || (data.permissions !== undefined
        && (!Array.isArray(data.permissions) || data.permissions.some(permission => typeof permission !== "string")))) {
      const error = new Error("用户信息格式错误")
      ElMessage.error(error.message)
      throw error
    }
    username.value = data.username
    roles.value = data.roles
    permissions.value = data.permissions ?? []
    // 防止路由守卫逻辑进入无限循环
    isGotUserInfo.value = true
  }

  // 登出
  const logout = () => {
    resetToken()
    // 重定向到登录页
    return router.replace("/login")
  }

  // 重置 Token
  const resetToken = () => {
    sessionVersion++
    removeToken()
    token.value = ""
    roles.value = []
    permissions.value = []
    username.value = ""
    isGotUserInfo.value = false
    resetRouter()
    usePermissionStore().resetRoutes()
  }

  return { token, roles, permissions, username, isGotUserInfo, getSessionVersion, setToken, getInfo, logout, resetToken }
})

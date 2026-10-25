import type { AxiosRequestConfig } from "axios"
import { getToken } from "@@/utils/local-storage"
import { isCancel } from "axios"
import { ElMessage } from "element-plus"
import { setActivePinia } from "pinia"
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest"
import { nextTick } from "vue"
import { request } from "@/http/axios"
import { pinia } from "@/pinia"
import { usePermissionStore } from "@/pinia/stores/permission"
import { useUserStore } from "@/pinia/stores/user"
import { resetRouter, router } from "@/router"
import { dynamicRoutes } from "@/router/routes"
import { deferred } from "../helpers/deferred"

interface FixtureUser {
  username: string
  roles: string[]
  permissions?: string[]
}

const api = vi.hoisted(() => {
  const user: FixtureUser = { username: "admin", roles: ["admin"], permissions: [] }
  const requests: AxiosRequestConfig[] = []
  const wait: { beforeResponse?: (config: AxiosRequestConfig) => Promise<void> } = {}
  return { user, requests, wait, invalidUser: false, infoFailure: false, failure: "" }
})

vi.mock("@/router/config", async () => {
  const { createMemoryHistory } = await import("vue-router")
  return { DASHBOARD_PATH: "/dashboard", routerConfig: { history: createMemoryHistory(), dynamic: true } }
})

// 在真实 Axios 实例的传输边界提供测试响应，保留实际请求处理和业务调用链。
vi.mock("axios", async (importOriginal) => {
  const actual = await importOriginal<typeof import("axios")>()
  actual.default.defaults.adapter = async (config) => {
    api.requests.push(config)
    // 发起时固定响应内容，允许旧响应晚于新会话返回。
    const user = api.invalidUser ? { username: "bad" } : api.user
    const infoFailure = api.infoFailure
    const failure = api.failure
    await api.wait.beforeResponse?.(config)
    if (config.url === "users/me" && infoFailure) throw new Error("用户信息服务不可用")
    const response = {
      data: { code: 0, message: "成功", data: config.url === "users/me" ? user : {} },
      status: 200,
      statusText: "OK",
      headers: {},
      config
    }
    if (failure === "envelope") return { ...response, data: null }
    if (failure === "business401") {
      response.data.code = 401
      response.data.message = "会话已失效"
    }
    if (failure === "http401") {
      response.status = 401
      throw new actual.AxiosError("未授权", "ERR_BAD_REQUEST", config, undefined, response)
    }
    return response
  }
  return actual
})

const initialDynamicRouteCount = dynamicRoutes.length

beforeAll(() => {
  setActivePinia(pinia)
})

beforeEach(async () => {
  useUserStore().resetToken()
  localStorage.clear()
  api.user = { username: "admin", roles: ["admin"], permissions: [] }
  api.invalidUser = false
  api.infoFailure = false
  api.failure = ""
  api.requests.length = 0
  api.wait.beforeResponse = undefined
  await router.replace("/login")
})

afterEach(() => {
  resetRouter()
  dynamicRoutes.splice(initialDynamicRouteCount)
  ElMessage.closeAll()
  vi.restoreAllMocks()
})

describe("登录守卫与动态权限", () => {
  it("匿名访问保留完整回跳地址，登录页无需身份请求", async () => {
    await router.push("/permission?next=%2Fdocs%3Fx%3D1#section")
    expect(router.currentRoute.value.path).toBe("/login")
    expect(router.currentRoute.value.query.redirect).toBe("/permission?next=%2Fdocs%3Fx%3D1#section")
    expect(api.requests).toHaveLength(0)
  })

  it.each([
    { username: "admin", roles: ["admin"], permissions: [] },
    { username: "reader", roles: [], permissions: ["permission:page-level"] }
  ])("角色或权限任一匹配即可注册并访问深链：$username", async (user) => {
    api.user = user
    useUserStore().setToken("test-token")
    await router.push("/permission?tab=one")
    expect(router.currentRoute.value.name).toBe("Permission")
    expect(router.currentRoute.value.query.tab).toBe("one")
    expect(api.requests.filter(item => item.url === "users/me")).toHaveLength(1)
    expect(api.requests[0].headers?.Authorization).toBe("Bearer test-token")
    await router.push("/dashboard")
    expect(api.requests.filter(item => item.url === "users/me")).toHaveLength(1)
  })

  it("无权限页面不注册，未知路径进入 404", async () => {
    api.user = { username: "reader", roles: ["reader"] }
    useUserStore().setToken("reader-token")
    await router.push("/permission")
    expect(router.currentRoute.value.name).toBe("NotFound")
    expect(router.hasRoute("Permission")).toBe(false)
    expect(useUserStore().permissions).toEqual([])
    await router.push("/does-not-exist")
    expect(router.currentRoute.value.name).toBe("NotFound")
  })

  it("退出清理父子动态路由，换用户后不会保留上个用户的权限", async () => {
    dynamicRoutes.push({
      path: "/nested",
      name: "Nested",
      meta: { roles: ["admin"] },
      children: [{ path: "child", name: "NestedChild", component: { template: "<div>子页</div>" } }]
    })
    useUserStore().setToken("admin-token")
    await router.push("/permission")
    expect(router.hasRoute("NestedChild")).toBe(true)
    await useUserStore().logout()
    expect(getToken()).toBeNull()
    expect(useUserStore().username).toBe("")
    expect(useUserStore().roles).toEqual([])
    expect(useUserStore().isGotUserInfo).toBe(false)
    expect(usePermissionStore().addRoutes).toEqual([])
    expect(router.hasRoute("Permission")).toBe(false)
    expect(router.hasRoute("Nested")).toBe(false)
    expect(router.hasRoute("NestedChild")).toBe(false)
    api.user = { username: "reader", roles: ["reader"], permissions: [] }
    useUserStore().setToken("reader-token")
    await router.push("/permission")
    expect(router.currentRoute.value.name).toBe("NotFound")
  })

  it("无可访问子页的分组和空权限数组不会被放行", () => {
    dynamicRoutes.push(
      { path: "/empty", name: "Empty", meta: { roles: [] }, component: { template: "<div />" } },
      { path: "/group", name: "Group", children: [{ path: "private", name: "Private", meta: { roles: ["admin"] }, component: { template: "<div />" } }] }
    )
    usePermissionStore().setRoutes({ roles: ["reader"], permissions: [] })
    expect(usePermissionStore().addRoutes).toEqual([])
  })

  it.each(["network", "contract", "envelope"])("用户信息失败后清理认证，停止重定向循环：%s", async (mode) => {
    const notify = vi.spyOn(ElMessage, "error")
    api.infoFailure = mode === "network"
    api.invalidUser = mode === "contract"
    api.failure = mode === "envelope" ? mode : ""
    useUserStore().setToken("invalid-token")
    await router.push("/dashboard")
    expect(router.currentRoute.value.path).toBe("/login")
    expect(getToken()).toBeNull()
    expect(usePermissionStore().addRoutes).toEqual([])
    const message = mode === "network" ? "用户信息服务不可用" : mode === "contract" ? "用户信息格式错误" : "非本系统的接口"
    expect(notify).toHaveBeenCalledExactlyOnceWith(message)
  })

  it.each(["business401", "http401"])("%s 拒绝请求并清空会话及动态权限", async (failure) => {
    useUserStore().setToken("expired-token")
    await router.push("/permission")
    api.failure = failure
    const notify = vi.spyOn(ElMessage, "error")
    await expect(request({ url: "probe" })).rejects.toBeDefined()
    await vi.waitFor(() => expect(router.currentRoute.value.path).toBe("/login"))
    expect(getToken()).toBeNull()
    expect(router.hasRoute("Permission")).toBe(false)
    expect(usePermissionStore().addRoutes).toEqual([])
    expect(notify).toHaveBeenCalledTimes(1)
  })

  it.each(["business401", "http401"])("当前用户信息请求返回 %s 仍完成注销且只提示一次", async (failure) => {
    const notify = vi.spyOn(ElMessage, "error")
    useUserStore().setToken("expired-token")
    api.failure = failure
    await router.push("/dashboard")
    await vi.waitFor(() => expect(router.currentRoute.value.path).toBe("/login"))
    expect(useUserStore().token).toBe("")
    expect(router.hasRoute("Permission")).toBe(false)
    expect(notify).toHaveBeenCalledTimes(1)
  })

  it.each(["success", "network", "business401", "http401"])("旧用户信息返回 %s 不覆盖或注销新会话", async (result) => {
    const gate = deferred<void>()
    api.infoFailure = result === "network"
    api.failure = result
    api.wait.beforeResponse = config => config.headers?.Authorization === "Bearer old-token" ? gate.promise : Promise.resolve()
    const user = useUserStore()
    const notify = vi.spyOn(ElMessage, "error")
    user.setToken("old-token")
    const oldNavigation = router.push("/permission")
    await vi.waitFor(() => expect(api.requests.some(config => config.headers?.Authorization === "Bearer old-token")).toBe(true))
    await user.logout()
    api.infoFailure = false
    api.failure = ""
    api.user = { username: "reader", roles: ["reader"], permissions: [] }
    user.setToken("new-token")
    await router.push("/dashboard")
    gate.resolve()
    await oldNavigation
    expect(user.token).toBe("new-token")
    expect(user.username).toBe("reader")
    expect(user.roles).toEqual(["reader"])
    expect(router.hasRoute("Permission")).toBe(false)
    expect(router.currentRoute.value.path).toBe("/dashboard")
    expect(notify).not.toHaveBeenCalled()
  })

  it.each([false, true])("退出后旧成功响应不能恢复身份；相同 Token 重新登录：%s", async (relogin) => {
    const gate = deferred<void>()
    api.wait.beforeResponse = () => gate.promise
    const user = useUserStore()
    user.setToken("same-token")
    const oldResult = user.getInfo().catch(error => error)
    await vi.waitFor(() => expect(api.requests).toHaveLength(1))
    await user.logout()
    if (relogin) user.setToken("same-token")
    gate.resolve()
    expect(isCancel(await oldResult)).toBe(true)
    expect(user.username).toBe("")
    expect(user.roles).toEqual([])
    expect(user.isGotUserInfo).toBe(false)
    expect(router.hasRoute("Permission")).toBe(false)
  })

  it("用户信息已取得后开启新会话也会清理旧权限", async () => {
    const user = useUserStore()
    user.setToken("same-token")
    await router.push("/permission")
    user.setToken("same-token")
    expect(user.username).toBe("")
    expect(user.isGotUserInfo).toBe(false)
    expect(router.hasRoute("Permission")).toBe(false)
    expect(usePermissionStore().addRoutes).toEqual([])
  })

  it("主动取消当前请求保留会话和权限，不弹错误", async () => {
    useUserStore().setToken("current-token")
    await router.push("/permission")
    const gate = deferred<void>()
    api.wait.beforeResponse = () => gate.promise
    const notify = vi.spyOn(ElMessage, "error")
    const controller = new AbortController()
    const result = request({ url: "probe", signal: controller.signal }).catch(error => error)
    await vi.waitFor(() => expect(api.requests.some(config => config.url === "probe")).toBe(true))
    controller.abort()
    gate.resolve()
    expect(isCancel(await result)).toBe(true)
    expect(useUserStore().token).toBe("current-token")
    expect(router.hasRoute("Permission")).toBe(true)
    expect(router.currentRoute.value.path).toBe("/permission")
    expect(notify).not.toHaveBeenCalled()
  })

  it("已登录访问登录页返回首页，403 页面可显示", async () => {
    useUserStore().setToken("test-token")
    await router.push("/dashboard")
    await router.push("/login")
    expect(router.currentRoute.value.path).toBe("/dashboard")
    await router.push("/403")
    expect(router.currentRoute.value.name).toBe("Forbidden")
    await nextTick()
    expect(document.title).toContain("访问受限")
  })
})

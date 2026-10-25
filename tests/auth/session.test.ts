import type { AxiosRequestConfig } from "axios"
import { getToken } from "@@/utils/local-storage"
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

interface FixtureUser {
  username: string
  roles: string[]
  permissions?: string[]
}

const api = vi.hoisted(() => {
  const user: FixtureUser = { username: "admin", roles: ["admin"], permissions: [] }
  const requests: AxiosRequestConfig[] = []
  return { user, requests, invalidUser: false, infoFailure: false, failure: "" }
})

vi.mock("@/router/config", async () => {
  const { createMemoryHistory } = await import("vue-router")
  return { DASHBOARD_PATH: "/dashboard", routerConfig: { history: createMemoryHistory(), dynamic: true } }
})

// 在真实 Axios 实例的传输边界提供测试响应，保留请求拦截器和业务调用链。
vi.mock("axios", async (importOriginal) => {
  const actual = await importOriginal<typeof import("axios")>()
  actual.default.defaults.adapter = async (config) => {
    api.requests.push(config)
    if (config.url === "users/me" && api.infoFailure) throw new Error("用户信息服务不可用")
    const response = {
      data: { code: 0, message: "成功", data: config.url === "users/me" ? (api.invalidUser ? { username: "bad" } : api.user) : {} },
      status: 200,
      statusText: "OK",
      headers: {},
      config
    }
    if (config.url === "probe" && api.failure === "business401") {
      response.data.code = 401
      response.data.message = "会话已失效"
    }
    if (config.url === "probe" && api.failure === "http401") {
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
  await router.replace("/login")
})

afterEach(() => {
  resetRouter()
  dynamicRoutes.splice(initialDynamicRouteCount)
  ElMessage.closeAll()
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

  it.each(["network", "contract"])("用户信息失败后清理认证，停止重定向循环：%s", async (mode) => {
    api.infoFailure = mode === "network"
    api.invalidUser = mode === "contract"
    useUserStore().setToken("invalid-token")
    await router.push("/dashboard")
    expect(router.currentRoute.value.path).toBe("/login")
    expect(getToken()).toBeNull()
    expect(usePermissionStore().addRoutes).toEqual([])
  })

  it.each(["business401", "http401"])("%s 拒绝请求并清空会话及动态权限", async (failure) => {
    useUserStore().setToken("expired-token")
    await router.push("/permission")
    api.failure = failure
    await expect(request({ url: "probe" })).rejects.toBeDefined()
    await vi.waitFor(() => expect(router.currentRoute.value.path).toBe("/login"))
    expect(getToken()).toBeNull()
    expect(router.hasRoute("Permission")).toBe(false)
    expect(usePermissionStore().addRoutes).toEqual([])
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

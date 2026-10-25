import { flushPromises, mount } from "@vue/test-utils"
import ElementPlus, { ElMessage } from "element-plus"
import { setActivePinia } from "pinia"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import App from "@/App.vue"
import { pinia } from "@/pinia"
import { useUserStore } from "@/pinia/stores/user"
import { installPlugins } from "@/plugins"
import { router } from "@/router"
import { deferred } from "../helpers/deferred"

const api = vi.hoisted(() => {
  const requests: { url: string | undefined, data: unknown }[] = []
  const wait: { beforeResponse?: (url: string | undefined) => Promise<void> } = {}
  return { requests, wait, captchaFailure: false, loginFailure: false, unauthorized: "" }
})

vi.mock("@/router/config", async () => {
  const { createMemoryHistory } = await import("vue-router")
  return { DASHBOARD_PATH: "/dashboard", routerConfig: { history: createMemoryHistory(), dynamic: true } }
})

vi.mock("axios", async (importOriginal) => {
  const actual = await importOriginal<typeof import("axios")>()
  actual.default.defaults.adapter = async (config) => {
    api.requests.push({ url: config.url, data: config.data })
    await api.wait.beforeResponse?.(config.url)
    if (config.url === "auth/captcha" && api.captchaFailure) throw new Error("后端未连接")
    if (config.url === "auth/login" && api.unauthorized === "http401") {
      throw new actual.AxiosError("登录被拒绝", "ERR_BAD_REQUEST", config, undefined, {
        data: { message: "登录被拒绝" },
        status: 401,
        statusText: "Unauthorized",
        headers: {},
        config
      })
    }
    const data = config.url === "auth/captcha"
      ? "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='100' height='30'%3E%3C/svg%3E"
      : config.url === "auth/login"
        ? { token: "test-token" }
        : { username: "alice", roles: ["admin"], permissions: [] }
    return {
      data: { code: config.url === "auth/login" ? (api.unauthorized === "business401" ? 401 : api.loginFailure ? 400 : 0) : 0, message: "登录被拒绝", data },
      status: 200,
      statusText: "OK",
      headers: {},
      config
    }
  }
  return actual
})

let wrapper: ReturnType<typeof mount> | undefined

beforeEach(async () => {
  setActivePinia(pinia)
  useUserStore().resetToken()
  api.requests.length = 0
  api.captchaFailure = false
  api.loginFailure = false
  api.wait.beforeResponse = undefined
  api.unauthorized = ""
  await router.replace("/login")
})

afterEach(() => {
  wrapper?.unmount()
  wrapper = undefined
  ElMessage.closeAll()
  vi.restoreAllMocks()
})

async function renderLogin(path = "/login", onError?: (error: unknown) => void) {
  await router.replace(path)
  wrapper = mount(App, { global: { plugins: [pinia, router, ElementPlus, installPlugins], config: { errorHandler: onError } } })
  await flushPromises()
  return wrapper
}

async function fillLogin(view: ReturnType<typeof mount>) {
  await view.get<HTMLInputElement>("input[autocomplete=\"username\"]").setValue("alice")
  await view.get<HTMLInputElement>("input[autocomplete=\"current-password\"]").setValue(" pass word ")
  await view.get<HTMLInputElement>("input[aria-label=\"验证码\"]").setValue("1234")
}

describe("最小页面交互", () => {
  it("不预填演示账号，保留表单校验而不发送空登录请求", async () => {
    const view = await renderLogin()
    expect(view.get<HTMLInputElement>("input[autocomplete=\"username\"]").element.value).toBe("")
    expect(view.get<HTMLInputElement>("input[autocomplete=\"current-password\"]").element.value).toBe("")
    await view.get("form").trigger("submit")
    await flushPromises()
    await vi.waitFor(() => expect(view.text()).toContain("请输入用户名"))
    expect(api.requests.some(item => item.url === "auth/login")).toBe(false)
    expect(view.get("button[type=\"submit\"]").attributes("disabled")).toBeUndefined()
  })

  it("任意用户名和合法表单可登录，编码后的回跳参数不会二次解码", async () => {
    const target = "/permission?next=%252Fdocs%253Fx%253D1%2526y%253D2#section"
    const view = await renderLogin(`/login?redirect=${encodeURIComponent(target)}`)
    await view.get<HTMLInputElement>("input[autocomplete=\"username\"]").setValue("alice")
    await view.get<HTMLInputElement>("input[autocomplete=\"current-password\"]").setValue(" pass word ")
    await view.get<HTMLInputElement>("input[aria-label=\"验证码\"]").setValue("1234")
    await view.get("form").trigger("submit")
    await vi.waitFor(() => expect(router.currentRoute.value.name).toBe("Permission"))
    expect(router.currentRoute.value.fullPath).toBe(target)
    expect(router.currentRoute.value.query.next).toBe("%2Fdocs%3Fx%3D1%26y%3D2")
    expect(api.requests.find(item => item.url === "auth/login")?.data).toBe(JSON.stringify({ username: "alice", password: " pass word ", code: "1234" }))
    await flushPromises()
    expect(view.text()).toContain("此段通过 v-permission 控制")
    expect(view.text()).not.toContain("此段通过 checkPermission 控制")
  })

  it("验证码失败有可见错误和可用的重试入口", async () => {
    api.captchaFailure = true
    const view = await renderLogin()
    expect(view.get("[role=\"alert\"]").text()).toContain("验证码加载失败")
    api.captchaFailure = false
    await view.get("button[aria-label=\"刷新验证码\"]").trigger("click")
    await flushPromises()
    expect(view.find("[role=\"alert\"]").exists()).toBe(false)
    expect(view.get("img[alt=\"验证码\"]").attributes("src")).toContain("data:image/svg+xml")
  })

  it("登录失败停留表单，清空密码并刷新验证码", async () => {
    api.loginFailure = true
    const view = await renderLogin()
    await view.get<HTMLInputElement>("input[autocomplete=\"username\"]").setValue("alice")
    await view.get<HTMLInputElement>("input[autocomplete=\"current-password\"]").setValue("wrong")
    await view.get<HTMLInputElement>("input[aria-label=\"验证码\"]").setValue("1234")
    await view.get("form").trigger("submit")
    await vi.waitFor(() => expect(api.requests.filter(item => item.url === "auth/captcha")).toHaveLength(2))
    expect(router.currentRoute.value.path).toBe("/login")
    expect(useUserStore().token).toBe("")
    expect(view.get<HTMLInputElement>("input[autocomplete=\"current-password\"]").element.value).toBe("")
    expect(view.get<HTMLInputElement>("input[autocomplete=\"username\"]").element.value).toBe("alice")
    await vi.waitFor(() => expect(view.get("button[type=\"submit\"]").attributes("disabled")).toBeUndefined())
  })

  it.each(["http401", "business401"])("匿名登录收到 %s 仍执行失败恢复，不当成旧会话取消", async (unauthorized) => {
    api.unauthorized = unauthorized
    const view = await renderLogin()
    const notify = vi.spyOn(ElMessage, "error")
    await fillLogin(view)
    await view.get("form").trigger("submit")
    await vi.waitFor(() => expect(api.requests.filter(item => item.url === "auth/captcha")).toHaveLength(2))
    expect(view.get<HTMLInputElement>("input[autocomplete=\"current-password\"]").element.value).toBe("")
    expect(useUserStore().token).toBe("")
    expect(notify).toHaveBeenCalledTimes(1)
  })

  it("校验、登录及用户信息加载期间连续提交只发送一次登录", async () => {
    const login = deferred<void>()
    const info = deferred<void>()
    api.wait.beforeResponse = url => url === "auth/login" ? login.promise : url === "users/me" ? info.promise : Promise.resolve()
    const view = await renderLogin()
    await fillLogin(view)
    const form = view.get("form")
    await Promise.all([form.trigger("submit"), form.trigger("submit")])
    await vi.waitFor(() => expect(api.requests.filter(item => item.url === "auth/login")).toHaveLength(1))
    expect(view.get("button[type=\"submit\"]").attributes("disabled")).toBeDefined()
    login.resolve()
    await vi.waitFor(() => expect(api.requests.some(item => item.url === "users/me")).toBe(true))
    expect(view.get("button[type=\"submit\"]").attributes("disabled")).toBeDefined()
    await form.trigger("submit")
    expect(api.requests.filter(item => item.url === "auth/login")).toHaveLength(1)
    info.resolve()
    await vi.waitFor(() => expect(router.currentRoute.value.path).toBe("/dashboard"))
  })

  it("旧登录响应取消后不覆盖新会话、不清空密码或刷新验证码", async () => {
    const gate = deferred<void>()
    api.wait.beforeResponse = url => url === "auth/login" ? gate.promise : Promise.resolve()
    const view = await renderLogin()
    const notify = vi.spyOn(ElMessage, "error")
    await fillLogin(view)
    await view.get("form").trigger("submit")
    await vi.waitFor(() => expect(api.requests.some(item => item.url === "auth/login")).toBe(true))
    useUserStore().setToken("new-session-token")
    gate.resolve()
    await vi.waitFor(() => expect(view.get("button[type=\"submit\"]").attributes("disabled")).toBeUndefined())
    expect(useUserStore().token).toBe("new-session-token")
    expect(view.get<HTMLInputElement>("input[autocomplete=\"current-password\"]").element.value).toBe(" pass word ")
    expect(api.requests.filter(item => item.url === "auth/captcha")).toHaveLength(1)
    expect(notify).not.toHaveBeenCalled()
  })

  it("验证码因会话切换取消时不展示加载失败", async () => {
    const gate = deferred<void>()
    api.wait.beforeResponse = () => gate.promise
    const notify = vi.spyOn(ElMessage, "error")
    const view = await renderLogin()
    useUserStore().resetToken()
    gate.resolve()
    await flushPromises()
    expect(view.find("[role=\"alert\"]").exists()).toBe(false)
    expect(notify).not.toHaveBeenCalled()
  })

  it("导航失败释放提交锁，并保留原始导航错误", async () => {
    const onError = vi.fn()
    const view = await renderLogin("/login", onError)
    await fillLogin(view)
    const failure = new Error("页面加载失败")
    vi.spyOn(router, "replace").mockRejectedValueOnce(failure)
    await view.get("form").trigger("submit")
    await vi.waitFor(() => expect(onError).toHaveBeenCalled())
    expect(onError.mock.calls[0][0]).toBe(failure)
    expect(view.get("button[type=\"submit\"]").attributes("disabled")).toBeUndefined()
    expect(api.requests.filter(item => item.url === "auth/captcha")).toHaveLength(1)
  })

  it("首页提供退出入口，403/404 保留错误展示", async () => {
    const view = await renderLogin()
    useUserStore().setToken("test-token")
    await router.push("/dashboard")
    await flushPromises()
    expect(view.text()).toContain("欢迎，alice")
    expect(view.text()).toContain("权限示例")
    for (const path of ["/403", "/404"]) {
      await router.push(path)
      await flushPromises()
      expect(view.find(".error-svg svg").exists()).toBe(true)
      expect(view.text()).toContain("回到首页")
    }
    await router.push("/dashboard")
    await flushPromises()
    const logoutButton = view.findAll("button").find(button => button.text() === "退出登录")
    expect(logoutButton).toBeDefined()
    await logoutButton?.trigger("click")
    await vi.waitFor(() => expect(router.currentRoute.value.path).toBe("/login"))
    expect(useUserStore().token).toBe("")
  })
})

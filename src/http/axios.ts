import type { AxiosRequestConfig } from "axios"
import { getToken } from "@@/utils/local-storage"
import axios, { CanceledError, isAxiosError, isCancel } from "axios"
import { merge } from "lodash-es"
import { useUserStore } from "@/pinia/stores/user"

const instance = axios.create()

/** 将响应处理绑定到发起请求的会话，旧结果只能取消，不能影响新会话。 */
export function request<T>(config: AxiosRequestConfig): Promise<T> {
  const userStore = useUserStore()
  const version = userStore.getSessionVersion()
  const token = getToken()
  // 默认配置
  const defaultConfig: AxiosRequestConfig = {
    // 接口地址
    baseURL: import.meta.env.VITE_BASE_URL,
    // 请求头
    headers: {
      // 携带 Token
      "Authorization": token ? `Bearer ${token}` : undefined,
      "Content-Type": "application/json"
    },
    // 请求体
    data: {},
    // 请求超时
    timeout: 5000,
    // 跨域请求时是否携带 Cookies
    withCredentials: false
  }
  // 将默认配置 defaultConfig 和传入的自定义配置 config 进行合并成为 mergeConfig
  const mergeConfig = merge(defaultConfig, config)
  return instance(mergeConfig).then(
    (response) => {
      if (version !== userStore.getSessionVersion()) throw new CanceledError("会话已变化")
      // apiData 是 api 返回的数据
      const apiData = response.data
      // 二进制数据则直接返回
      const responseType = response.config.responseType
      if (responseType === "blob" || responseType === "arraybuffer") return apiData
      // 这个 code 是和后端约定的业务 code
      const code = apiData?.code
      // 如果没有 code, 代表这不是项目后端开发的 api
      if (code === undefined) {
        ElMessage.error("非本系统的接口")
        return Promise.reject(new Error("非本系统的接口"))
      }
      switch (code) {
        case 0:
        // 本系统采用 code === 0 来表示没有业务错误
          return apiData
        case 401:
        // Token 过期时
          // 匿名登录的 401 是登录失败，不应开启新会话、打断表单恢复。
          if (token) userStore.logout()
          ElMessage.error(apiData.message || "登录已过期，请重新登录")
          return Promise.reject(apiData)
        default:
        // 不是正确的 code
          ElMessage.error(apiData.message || "Error")
          return Promise.reject(apiData)
      }
    },
    (error: unknown) => {
      if (isCancel(error)) return Promise.reject(error)
      if (version !== userStore.getSessionVersion()) {
        const canceled = new CanceledError("会话已变化")
        if (error instanceof Error) canceled.cause = error
        return Promise.reject(canceled)
      }
      let errorMessage = error instanceof Error ? error.message : "请求失败"
      // status 是 HTTP 状态码
      const response = isAxiosError<{ message?: unknown }>(error) ? error.response : undefined
      const status = response?.status
      const message = typeof response?.data?.message === "string" ? response.data.message : undefined
      switch (status) {
        case 400:
          errorMessage = "请求错误"
          break
        case 401:
        // Token 过期时
          errorMessage = message || "未授权"
          if (token) userStore.logout()
          break
        case 403:
          errorMessage = message || "拒绝访问"
          break
        case 404:
          errorMessage = "请求地址出错"
          break
        case 408:
          errorMessage = "请求超时"
          break
        case 500:
          errorMessage = "服务器内部错误"
          break
        case 501:
          errorMessage = "服务未实现"
          break
        case 502:
          errorMessage = "网关错误"
          break
        case 503:
          errorMessage = "服务不可用"
          break
        case 504:
          errorMessage = "网关超时"
          break
        case 505:
          errorMessage = "HTTP 版本不受支持"
          break
      }
      if (error instanceof Error) error.message = errorMessage
      ElMessage.error(errorMessage)
      return Promise.reject(error)
    }
  )
}

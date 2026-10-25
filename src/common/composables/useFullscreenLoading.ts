import type { LoadingOptions } from "element-plus"

interface LoadingInstance {
  close: () => void
}

// Element Plus 全屏服务可能返回同一实例，跨包装函数也要等所有调用结束。
const activeInstances = new Map<LoadingInstance, { pending: number }>()

const DEFAULT_OPTIONS = {
  lock: true,
  text: "加载中..."
}

/**
 * @name 全屏加载 Composable
 * @description 传入一个函数 fn，在它执行周期内，加上「全屏」Loading
 * @param fn 要执行的函数
 * @param options LoadingOptions
 * @returns 返回一个新的函数，该函数返回一个 Promise
 */
export function useFullscreenLoading<Args extends unknown[], Result>(fn: (...args: Args) => Result, options: LoadingOptions = {}) {
  return async (...args: Args): Promise<Awaited<Result>> => {
    const loadingInstance = ElLoading.service({ ...DEFAULT_OPTIONS, ...options })
    let activity = activeInstances.get(loadingInstance)
    if (!activity) {
      activity = { pending: 0 }
      activeInstances.set(loadingInstance, activity)
    }
    activity.pending++
    try {
      return await fn(...args)
    } finally {
      activity.pending--
      if (activity.pending === 0) {
        activeInstances.delete(loadingInstance)
        loadingInstance.close()
      }
    }
  }
}

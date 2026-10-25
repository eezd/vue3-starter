import type { MockInstance } from "vitest"
import { useFullscreenLoading } from "@@/composables/useFullscreenLoading"
import { ElLoading } from "element-plus"
import { afterEach, beforeEach, describe, expect, expectTypeOf, it, vi } from "vitest"
import { nextTick } from "vue"
import { deferred } from "../helpers/deferred"

let service: MockInstance<typeof ElLoading.service>

beforeEach(() => {
  vi.useFakeTimers()
  service = vi.spyOn(ElLoading, "service")
})

afterEach(async () => {
  // 使用真实 Loading 服务，清理它的过渡动画与 DOM。
  await nextTick()
  for (const result of service.mock.results) {
    if (result.type === "return" && result.value.visible.value) result.value.close()
  }
  vi.runAllTimers()
  await nextTick()
  vi.restoreAllMocks()
  vi.useRealTimers()
})

describe("加载包装器", () => {
  it("并发的非全屏实例各自关闭，不关闭其他调用的遮罩", async () => {
    const wrap = useFullscreenLoading((task: Promise<number>) => task, { fullscreen: false })
    const first = deferred<number>()
    const second = deferred<number>()
    const a = wrap(first.promise)
    const b = wrap(second.promise)
    const one = service.mock.results[0].value
    const two = service.mock.results[1].value
    expect(one).not.toBe(two)
    const closeOne = vi.spyOn(one, "close")
    const closeTwo = vi.spyOn(two, "close")
    first.resolve(1)
    expect(await a).toBe(1)
    expect(closeOne).toHaveBeenCalledTimes(1)
    expect(closeTwo).not.toHaveBeenCalled()
    second.resolve(2)
    expect(await b).toBe(2)
    expect(closeTwo).toHaveBeenCalledTimes(1)
  })

  it.each([true, false])("不同包装器共享全屏实例，最后一个调用结束才关闭；首个失败：%s", async (failFirst) => {
    const first = deferred<number>()
    const second = deferred<number>()
    const wrapOne = useFullscreenLoading(() => first.promise)
    const wrapTwo = useFullscreenLoading(() => second.promise)
    const a = wrapOne()
    const b = wrapTwo()
    const instance = service.mock.results[0].value
    expect(service.mock.results[1].value).toBe(instance)
    const close = vi.spyOn(instance, "close")
    const failure = new Error("业务操作失败")
    if (failFirst) {
      const rejection = expect(a).rejects.toBe(failure)
      first.reject(failure)
      await rejection
    } else {
      first.resolve(1)
      await a
    }
    expect(close).not.toHaveBeenCalled()
    second.resolve(2)
    expect(await b).toBe(2)
    expect(close).toHaveBeenCalledTimes(1)
  })

  it("全部结束后再次调用创建新实例，参数和异步结果类型保持正确", async () => {
    const wrap = useFullscreenLoading(async (value: number) => value * 2)
    const first = wrap(3)
    expectTypeOf(first).toEqualTypeOf<Promise<number>>()
    expect(await first).toBe(6)
    const oldInstance = service.mock.results[0].value
    expect(await wrap(4)).toBe(8)
    expect(service.mock.results[1].value).not.toBe(oldInstance)
  })

  it("同步抛错保留原始异常，同时释放 Loading", async () => {
    const error = new Error("业务同步失败")
    const wrap = useFullscreenLoading(() => {
      throw error
    })
    const result = wrap()
    const instance = service.mock.results[0].value
    expect(instance.visible.value).toBe(false)
    await expect(result).rejects.toBe(error)
  })

  it("创建 Loading 失败保留原始错误，不执行业务操作", async () => {
    const error = new Error("Loading 创建失败")
    service.mockImplementationOnce(() => {
      throw error
    })
    const operation = vi.fn()
    await expect(useFullscreenLoading(operation)()).rejects.toBe(error)
    expect(operation).not.toHaveBeenCalled()
  })
})

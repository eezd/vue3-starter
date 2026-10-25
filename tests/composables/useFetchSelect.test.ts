import { useFetchSelect } from "@@/composables/useFetchSelect"
import { flushPromises, mount } from "@vue/test-utils"
import { afterEach, describe, expect, it, vi } from "vitest"
import { defineComponent } from "vue"
import { deferred } from "../helpers/deferred"

const views: ReturnType<typeof mount>[] = []

function renderSelect(api: Parameters<typeof useFetchSelect>[0]["api"]) {
  const view = mount(defineComponent({
    setup: () => useFetchSelect({ api }),
    render: () => null
  }))
  views.push(view)
  return view
}

afterEach(() => views.splice(0).forEach(view => view.unmount()))

describe("异步下拉", () => {
  it("挂载后加载真实选项并结束加载状态", async () => {
    const task = deferred<ApiResponseData<{ value: string, label: string }[]>>()
    const api = vi.fn(() => task.promise)
    const view = renderSelect(api)
    expect(api).toHaveBeenCalledTimes(1)
    expect(view.vm.loading).toBe(true)
    expect(view.vm.error).toBeUndefined()
    const options = [{ value: "one", label: "选项一" }]
    task.resolve({ code: 0, data: options, message: "成功" })
    await flushPromises()
    expect(view.vm.options).toEqual(options)
    expect(view.vm.loading).toBe(false)
    expect(view.vm.error).toBeUndefined()
  })

  it("失败保留原始异常并结束加载，不产生未处理 rejection", async () => {
    const task = deferred<ApiResponseData<never[]>>()
    const view = renderSelect(() => task.promise)
    const error = new Error("下拉接口失败")
    task.reject(error)
    await flushPromises()
    expect(view.vm.loading).toBe(false)
    expect(view.vm.error).toBe(error)
    expect(view.vm.options).toEqual([])
  })

  it("成功空列表与加载失败通过 error 状态区分", async () => {
    const view = renderSelect(async () => ({ code: 0, data: [], message: "成功" }))
    await flushPromises()
    expect(view.vm.options).toEqual([])
    expect(view.vm.error).toBeUndefined()
    expect(view.vm.loading).toBe(false)
  })
})

---
name: v3-use-composables
description: 使用本项目现有分页、异步下拉、全屏加载和页面标题组合函数；不提供主题或后台布局能力。
---

# 内置组合函数

先读 AGENTS.md，再读目标函数的当前签名，避免照搬过时参数。

| 函数 | 文件 | 约定 |
| --- | --- | --- |
| usePagination | `src/common/composables/usePagination.ts` | 管理分页状态；通过 callback 和 watchPagination 组织首次查询及翻页，搜索调用 resetCurrentPage，接口字段按后端映射 |
| useFetchSelect | `src/common/composables/useFetchSelect.ts` | 接收 api 函数，返回 loading/options/value/error；挂载时加载，失败在 error 中保留原始异常，不能把失败当成功空列表 |
| useFullscreenLoading | `src/common/composables/useFullscreenLoading.ts` | 包装同步或异步操作，透传参数、结果与异常；独立实例各自关闭，共享实例最后一个调用结束后关闭 |
| useTitle | `src/common/composables/useTitle.ts` | 由路由后置钩子设置标题，复用现有 VITE_APP_TITLE |

- 导入路径为 `@@/composables/useXxx`；页面私有组合函数放其 `composables/` 子目录。
- 只有实际共享能力才加入 common，不因为一个函数稍长就创建全局封装。
- 主题、布局、水印、菜单事件等功能已移除，不因旧示例缺失而自动恢复。
- 错误由负责层处理，不在请求层已经提示后重复显示同一错误，不用空数组伪造加载成功。

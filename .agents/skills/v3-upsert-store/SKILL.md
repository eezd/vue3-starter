---
name: v3-upsert-store
description: 为本项目新增或调整 Pinia 共享状态；先判断是否确实跨页面共享，避免把页面临时状态全局化。
---

# Pinia 状态

先读 AGENTS.md 和相邻 store，确认状态归属、使用者与实际生命周期。

- 只有跨页面共享的状态才放 `src/pinia/stores/<name>.ts`，使用 Setup Store；表单、弹窗、单页加载状态放页面内部。
- store 文件名和 ID 使用 kebab-case，导出 useXxxStore。类型就近定义，优先使用可以推导的类型。
- 在实际调用位置获取 store；需要在 setup 外使用时可显式传入 `@/pinia` 的 pinia，不默认生成纯转发 Outside 函数。
- 只有明确需要持久化时才写 localStorage，并把生命周期与重置时机写清楚。基础认证 Token 使用现有工具；业务模块自己的持久化逻辑留在所属模块。
- 不自动添加所有字段的 watch/watchEffect、默认值兜底或多份镜像状态；直接在负责变更的 action 同步必要状态。
- 修改认证状态时同时核对路由守卫和请求层调用，注销后清除用户及动态权限。
- 只导出调用方需要的状态和操作，不机械追加空 action、reset 或包装函数。

验证状态变化、失败处理、重置和已有调用方；按风险补充行为测试，执行相关检查。

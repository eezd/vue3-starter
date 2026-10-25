---
name: v3-use-utils
description: 使用本项目认证存储、权限判断、类型判断及日期格式化工具；适用于复用已有公共工具的任务。
---

# 内置工具

先读 AGENTS.md 和目标工具的实现，使用实际存在的能力。

| 位置 | 能力与契约 |
| --- | --- |
| `@@/utils/local-storage` | getToken/setToken/removeToken；认证 Token 的存储键由 CacheKey.TOKEN 定义 |
| `@@/utils/permission` | checkPermission 接收非空角色或权限数组，满足任一项即返回 true；展示层使用，不代替后端鉴权 |
| `@@/utils/validate` | 已有类型及外链判断，按实际需要使用 |
| `@@/utils/datetime` | formatDateTime 使用 dayjs；默认格式 YYYY-MM-DD HH:mm:ss，无效日期按现有显示契约返回 N/A |

页面自己的业务转换或存储留在页面模块；真实跨模块复用时再提取。不要为假想调用方添加工具，不恢复已移除的布局、主题、侧栏和标签页存储。

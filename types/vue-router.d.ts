import "vue-router"

export {}

declare module "vue-router" {
  interface RouteMeta {
    /** 页面标题 */
    title?: string
    /** 可访问角色，与 permissions 为 OR 关系 */
    roles?: string[]
    /** 可访问权限，与 roles 为 OR 关系 */
    permissions?: string[]
  }
}

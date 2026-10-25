import type { App } from "vue"
import { installPermissionDirective } from "./permission-directive"

export function installPlugins(app: App) {
  installPermissionDirective(app)
}

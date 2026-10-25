<script setup lang="ts">
import { checkPermission } from "@@/utils/permission"
import { useUserStore } from "@/pinia/stores/user"

const userStore = useUserStore()
</script>

<template>
  <main class="app-container">
    <el-card header="权限示例" shadow="never">
      <p>当前页面要求 admin 角色或 permission:page-level 权限。</p>
      <p>当前角色：{{ userStore.roles.join("、") || "无" }}</p>
      <p>当前权限：{{ userStore.permissions.join("、") || "无" }}</p>
      <p v-permission="['admin']">
        此段通过 v-permission 控制，仅 admin 可见。
      </p>
      <p v-if="checkPermission(['permission:button-level'])">
        此段通过 checkPermission 控制，需要 permission:button-level 权限。
      </p>
      <el-text type="info">
        前端权限仅控制展示，接口仍需后端鉴权。
      </el-text>
      <p>
        <router-link to="/">
          <el-button>返回首页</el-button>
        </router-link>
      </p>
    </el-card>
  </main>
</template>

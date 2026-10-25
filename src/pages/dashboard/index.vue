<script setup lang="ts">
import { usePermissionStore } from "@/pinia/stores/permission"
import { useUserStore } from "@/pinia/stores/user"

const userStore = useUserStore()
const permissionStore = usePermissionStore()
</script>

<template>
  <main class="app-container dashboard">
    <el-card shadow="never">
      <h1>欢迎，{{ userStore.username }}</h1>
      <p>这是通用前端起步模板，请在 pages 中添加业务模块。</p>
      <p>当前角色：{{ userStore.roles.join("、") || "无" }}</p>
      <div class="actions">
        <router-link v-for="route in permissionStore.addRoutes" :key="route.name" :to="route.path">
          <el-button>{{ route.meta?.title }}</el-button>
        </router-link>
        <el-button @click="userStore.logout()">
          退出登录
        </el-button>
      </div>
    </el-card>
  </main>
</template>

<style scoped lang="scss">
.dashboard {
  max-width: 900px;
  margin: 0 auto;
}

.actions {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
}
</style>

<script setup lang="ts">
import type { FormRules } from "element-plus"
import type { LoginRequestData } from "./apis/type"
import { useUserStore } from "@/pinia/stores/user"
import { getCaptchaApi, loginApi } from "./apis"

const route = useRoute()
const router = useRouter()
const userStore = useUserStore()
const loginFormRef = useTemplateRef("loginFormRef")
const loading = ref(false)
const codeUrl = ref("")
const captchaError = ref("")
const title = import.meta.env.VITE_APP_TITLE

const loginFormData = reactive<LoginRequestData>({ username: "", password: "", code: "" })
const loginFormRules: FormRules<LoginRequestData> = {
  username: [{ required: true, message: "请输入用户名", trigger: "blur" }],
  password: [{ required: true, message: "请输入密码", trigger: "blur" }],
  code: [{ required: true, message: "请输入验证码", trigger: "blur" }]
}

async function createCode() {
  loginFormData.code = ""
  codeUrl.value = ""
  captchaError.value = ""
  try {
    const { data } = await getCaptchaApi()
    codeUrl.value = data
  } catch {
    // 请求层已报告原因，此处提供持续可见的重试入口。
    captchaError.value = "验证码加载失败，请检查后端配置后重试"
  }
}

async function handleLogin() {
  if (loading.value) return
  const valid = await loginFormRef.value?.validate().catch(() => false)
  if (!valid) return
  loading.value = true
  try {
    const { data } = await loginApi(loginFormData)
    userStore.setToken(data.token)
  } catch {
    // 登录失败保留表单，让用户修改后重试；错误由请求层统一提示。
    loginFormData.password = ""
    await createCode()
    return
  } finally {
    loading.value = false
  }
  // Vue Router 已解码查询参数；只接受站内路径，不再次 decodeURIComponent。
  const redirect = route.query.redirect
  await router.replace(typeof redirect === "string" && redirect.startsWith("/") && !redirect.startsWith("//") ? redirect : "/")
}

onMounted(createCode)
</script>

<template>
  <main class="login-container">
    <el-card class="login-card" shadow="never">
      <h1>{{ title }}</h1>
      <el-form ref="loginFormRef" :model="loginFormData" :rules="loginFormRules" @submit.prevent="handleLogin">
        <el-form-item prop="username">
          <el-input v-model.trim="loginFormData.username" placeholder="用户名" autocomplete="username" aria-label="用户名" />
        </el-form-item>
        <el-form-item prop="password">
          <el-input v-model="loginFormData.password" placeholder="密码" type="password" autocomplete="current-password" aria-label="密码" show-password />
        </el-form-item>
        <el-form-item prop="code">
          <el-input v-model.trim="loginFormData.code" placeholder="验证码" autocomplete="off" aria-label="验证码">
            <template #append>
              <button type="button" class="captcha-button" aria-label="刷新验证码" @click="createCode">
                <img v-if="codeUrl" :src="codeUrl" alt="验证码">
                <span v-else>重试验证码</span>
              </button>
            </template>
          </el-input>
        </el-form-item>
        <p v-if="captchaError" role="alert" class="captcha-error">
          {{ captchaError }}
        </p>
        <el-button :loading="loading" type="primary" native-type="submit" class="login-button">
          登录
        </el-button>
      </el-form>
    </el-card>
  </main>
</template>

<style scoped lang="scss">
.login-container {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: 100%;
  padding: 20px;
}

.login-card {
  width: 400px;
  max-width: 100%;

  h1 {
    margin: 0 0 24px;
    text-align: center;
  }
}

.captcha-button {
  display: grid;
  width: 100px;
  height: 30px;
  padding: 0;
  place-items: center;
  border: 0;
  background: transparent;
  cursor: pointer;

  img {
    max-width: 100%;
    max-height: 100%;
  }
}

.captcha-error {
  color: var(--el-color-danger);
}

.login-button {
  width: 100%;
}
</style>

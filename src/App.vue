<script setup lang="ts">
import { ref } from 'vue'
import { RouterLink, RouterView, useRoute } from 'vue-router'
import { hasApiKey, setApiKey, getQueue } from '@/lib/api'

const route = useRoute()
const authed = ref(hasApiKey())
const keyInput = ref('')
const loginErr = ref('')
const loading = ref(false)

async function doLogin() {
  const key = keyInput.value.trim()
  if (!key) return
  loading.value = true
  loginErr.value = ''
  setApiKey(key)
  try {
    await getQueue()
    authed.value = true
  } catch {
    localStorage.removeItem('nov_api_key')
    loginErr.value = '密钥错误'
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <div v-if="!authed" class="login-overlay">
    <div class="login-box">
      <h1>Novel 管理</h1>
      <input v-model="keyInput" type="password" placeholder="输入 API Key" @keydown.enter="doLogin" autofocus />
      <button :disabled="loading" @click="doLogin">{{ loading ? '验证中...' : '登录' }}</button>
      <p v-if="loginErr" class="login-err">{{ loginErr }}</p>
    </div>
  </div>

  <template v-else>
    <header>
      <h1>{{ route.name === 'upload' ? '上传新小说' : '小说管理系统' }}</h1>
      <div class="header-actions">
        <RouterLink v-if="route.name === 'home'" to="/upload" class="btn btn-primary">上传新小说</RouterLink>
        <RouterLink v-else to="/" class="btn btn-outline">返回管理</RouterLink>
      </div>
    </header>
    <RouterView />
  </template>
</template>

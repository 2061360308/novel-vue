<script setup lang="ts">
import { RouterLink, RouterView, useRoute } from 'vue-router'
const route = useRoute()
</script>

<template>
  <header>
    <h1>{{ route.name === 'upload' ? '上传新小说' : '小说管理系统' }}</h1>
    <div class="header-actions">
      <RouterLink v-if="route.name === 'home'" to="/upload" class="btn btn-primary">上传新小说</RouterLink>
      <RouterLink v-else to="/" class="btn btn-outline">返回管理</RouterLink>
    </div>
  </header>

  <RouterView />
</template>

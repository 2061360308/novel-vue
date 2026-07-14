<template>
  <div class="docs-wrapper">
    <div v-if="loading" class="loading">加载 API 文档中...</div>
    <div v-else-if="error" class="error">
      <p>文档加载失败：{{ error }}</p>
      <button @click="retry">重试</button>
    </div>
    <ApiReference v-else :configuration="config" />
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { ApiReference } from '@scalar/api-reference';
import '@scalar/api-reference/style.css';
import { getApiDocs } from '@/lib/api';

// ---------- 加载状态 ----------
const loading = ref(true);
const error = ref<string | null>(null);

// ---------- Scalar 配置 ----------
// 使用 as const 固定所有字面量类型
const baseConfig = {
  theme: 'purple' as const,
  darkMode: true,
  layout: 'modern' as const,
  authentication: {
    preferredSecurityScheme: 'BearerAuth' as const,
    http: {
      bearer: {
        token: localStorage.getItem('nov_api_key') || '',
      },
    },
  },
  spec: { content: {} },
};

// 用 ref 存储配置，类型自动推导为字面量
const config = ref(baseConfig);

// ---------- 加载规范 ----------
async function loadDocs() {
  try {
    loading.value = true;
    error.value = null;

    const specData = await getApiDocs();

    // 更新配置：保留其他配置，只替换 spec
    config.value = {
      ...baseConfig,        // 复用基础配置
      spec: { content: specData },
    };
  } catch (err: any) {
    error.value = err.message || '未知错误';
  } finally {
    loading.value = false;
  }
}

// ---------- 重试 ----------
function retry() {
  loadDocs();
}

// ---------- 生命周期 ----------
onMounted(() => {
  loadDocs();
});
</script>

<style scoped>
/* 样式保持不变 */
.docs-wrapper {
  height: 100vh;
  width: 100%;
  position: relative;
}
.loading,
.error {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100%;
  font-size: 1.2rem;
  color: #666;
}
.error button {
  margin-top: 1rem;
  padding: 0.5rem 1.5rem;
  border: none;
  background: #7c3aed;
  color: white;
  border-radius: 6px;
  cursor: pointer;
}
</style>
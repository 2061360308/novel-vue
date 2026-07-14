import { createRouter, createWebHistory } from 'vue-router'
import ManagerView from '../views/ManagerView.vue'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    { path: '/', name: 'home', component: ManagerView },
    { path: '/upload', name: 'upload', component: () => import('../views/UploadView.vue') },
    { path: '/docs', name: 'docs', component: () => import('../views/ApiDocs.vue') },
  ],
})

export default router

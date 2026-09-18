import { createRouter, createWebHashHistory } from 'vue-router'
import { apiJson, getToken } from '@/lib/api'
import { useToast } from '@/composables/useToast'

const routes = [
  { path: '/',         redirect: '/login' },
  { path: '/login',    component: () => import('@/views/LoginView.vue'),    meta: { title: '登录' } },
  { path: '/home',     component: () => import('@/views/HomeView.vue'),     meta: { title: '岗位列表', requiresAuth: true } },
  { path: '/job/:id',  component: () => import('@/views/JobDetailView.vue'),meta: { title: '岗位详情', requiresAuth: true } },
  { path: '/profile',  component: () => import('@/views/ProfileView.vue'),  meta: { title: '个人中心', requiresAuth: true } },
  { path: '/admin',    component: () => import('@/views/AdminView.vue'),    meta: { title: '管理后台', requiresAuth: true, roles: ['ADMIN', 'SUPER_ADMIN'] } },
]

const router = createRouter({
  history: createWebHashHistory(),
  routes,
  scrollBehavior: () => ({ top: 0 })
})

async function guardRoute(readRoute) {
  if (!readRoute.meta.requiresAuth) return true
  if (!getToken()) {
    return { path: '/login', query: { target: readRoute.path === '/admin' ? 'admin' : 'user' } }
  }
  const readRoles = readRoute.meta.roles || []
  if (!readRoles.length) return true
  try {
    const readUser = await apiJson('/user/me')
    if (readRoles.includes(readUser?.role)) return true
    useToast().error('当前账号没有管理员权限')
    return '/home'
  } catch (readError) {
    if (readError?.code !== 401) useToast().error(readError?.message || '管理员身份校验失败')
    return '/login'
  }
}

router.beforeEach(guardRoute)

router.afterEach(to => {
  document.title = `${to.meta.title || '复新生涯'} — FusionCareer`
})

export default router

import type { RouteRecordRaw } from 'vue-router';

import { $t } from '#/locales';

/**
 * 业务路由，对应 openapi/openapi.yaml 中的 Books / Role / Permission / SystemConfig / PicUpload
 * meta.authority 按 GET /me 返回的角色过滤：admin（管理员）、reader（读者）
 */
const routes: RouteRecordRaw[] = [
  {
    name: 'BookManage',
    path: '/books',
    component: () => import('#/views/books/index.vue'),
    meta: {
      authority: ['admin', 'reader'],
      icon: 'lucide:book-open',
      keepAlive: true,
      order: 10,
      title: $t('page.books.title'),
    },
  },
  {
    name: 'SystemConfig',
    path: '/system/configs',
    component: () => import('#/views/system/config/index.vue'),
    meta: {
      authority: ['admin'],
      icon: 'lucide:settings-2',
      order: 20,
      title: $t('page.systemConfig.title'),
    },
  },
  {
    name: 'RoleManage',
    path: '/system/roles',
    component: () => import('#/views/system/role/index.vue'),
    meta: {
      authority: ['admin'],
      icon: 'lucide:user-cog',
      order: 21,
      title: $t('page.systemRole.title'),
    },
  },
  {
    name: 'PermissionList',
    path: '/system/permissions',
    component: () => import('#/views/system/permission/index.vue'),
    meta: {
      authority: ['admin'],
      icon: 'lucide:shield-check',
      order: 22,
      title: $t('page.systemPermission.title'),
    },
  },
  {
    name: 'PicUpload',
    path: '/pic/upload',
    component: () => import('#/views/pic/index.vue'),
    meta: {
      authority: ['admin', 'reader'],
      icon: 'lucide:image-up',
      order: 30,
      title: $t('page.picUpload.title'),
    },
  },
];

export default routes;

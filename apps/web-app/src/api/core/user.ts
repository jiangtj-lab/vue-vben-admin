import type { UserInfo } from '@vben/types';

import { preferences } from '@vben/preferences';

import { getCurrentUserApi } from '#/api/core/auth';

/**
 * 获取用户信息
 * demo-backend 的 /me 只返回 username、nickname、roles、permissions，
 * 这里转换成 vben 内部使用的 UserInfo 结构
 */
export async function getUserInfoApi(): Promise<UserInfo> {
  const me = await getCurrentUserApi();

  return {
    avatar: preferences.app.defaultAvatar,
    desc: me.username,
    homePath: preferences.app.defaultHomePath,
    realName: me.nickname || me.username,
    roles: me.roles ?? [],
    token: '',
    userId: me.username,
    username: me.username,
  };
}

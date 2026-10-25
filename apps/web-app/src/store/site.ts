import { computed, ref } from 'vue';

import { preferences } from '@vben/preferences';

import { defineStore } from 'pinia';

import { getPublicSystemConfigsApi } from '#/api';

/** 站点名称配置项 key */
const SITE_NAME_KEY = 'demo.site.name';
/** 站点描述配置项 key */
const SITE_DESCRIPTION_KEY = 'demo.site.description';

/**
 * 站点公开信息（GET /system/configs/public，无需登录与权限）
 * 接口返回的配置项在启动时加载一次，用于渲染站点名称、描述等基础信息
 */
export const useSiteStore = defineStore('site', () => {
  /** 公开配置项，key -> value */
  const configs = ref<Record<string, string>>({});
  const loading = ref(false);
  /** 并发调用时复用同一个请求 */
  let loadingPromise: null | Promise<void> = null;

  /** 站点名称，接口未返回时回退到偏好设置中的应用名称 */
  const siteName = computed(
    () => configs.value[SITE_NAME_KEY]?.trim() || preferences.app.name,
  );

  /** 站点描述，接口未返回时为空字符串 */
  const siteDescription = computed(
    () => configs.value[SITE_DESCRIPTION_KEY]?.trim() || '',
  );

  /**
   * 加载公开配置项
   * @param force 是否强制重新请求（默认复用已加载的数据）
   */
  function loadConfigs(force = false): Promise<void> {
    if (loadingPromise) {
      return loadingPromise;
    }
    if (!force && Object.keys(configs.value).length > 0) {
      return Promise.resolve();
    }

    loading.value = true;
    loadingPromise = (async () => {
      try {
        const items = await getPublicSystemConfigsApi();
        configs.value = Object.fromEntries(
          (items ?? []).map((item) => [item.key, item.value]),
        );
      } catch (error) {
        // 公开配置只影响站点信息展示，失败时保持默认值，不阻塞应用启动
        console.warn('[site] 加载公开配置失败', error);
      } finally {
        loading.value = false;
        loadingPromise = null;
      }
    })();

    return loadingPromise;
  }

  /** 读取任意公开配置项，不存在时返回默认值 */
  function getConfig(key: string, fallback = '') {
    return configs.value[key] ?? fallback;
  }

  /**
   * 站点公开信息与登录用户无关，退出登录时 resetAllStores 会调用 $reset，
   * 这里不做任何清理，避免站点名称回退为默认值
   */
  function $reset() {}

  return {
    $reset,
    configs,
    getConfig,
    loadConfigs,
    loading,
    siteDescription,
    siteName,
  };
});

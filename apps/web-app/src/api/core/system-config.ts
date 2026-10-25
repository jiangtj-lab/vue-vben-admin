import type { JsonSchema } from '#/types/openapi';

import { requestClient } from '#/api/request';

export namespace SystemConfigApi {
  /** 前端渲染类型 */
  export type ItemType =
    | 'JSON'
    | 'MULTI_SELECT'
    | 'SELECT'
    | 'SWITCH'
    | 'TEXT'
    | 'TEXTAREA';

  /** 可选值，first 为值、second 为显示文本 */
  export interface ProviderEntry {
    first: string;
    second: string;
  }

  /** 配置项分组 */
  export interface Group {
    name: string;
    /** 分组排序号（升序） */
    order: number;
  }

  /** 系统配置项信息 */
  export interface ItemInfo {
    description: string;
    /** 格式化后的展示值（历史拼写） */
    formatedValue?: string;
    group: Group;
    /** 是否存在持久化的覆盖值 */
    isModified: boolean;
    key: string;
    name: string;
    /** 修改后是否需要刷新配置缓存 */
    needRefresh: boolean;
    /** 同组内排序号（升序） */
    order: number;
    /** 可选值列表 */
    provider: ProviderEntry[];
    /** JSON 类型配置项的结构描述 */
    schema?: JsonSchema;
    /** 是否为敏感项（整体脱敏） */
    secret: boolean;
    /** JSON 类型下需要局部脱敏的字段路径 */
    secretPaths: string[];
    /** 分类标签 */
    tag: string[];
    type: ItemType;
    /** 当前值；secret 项在此处已脱敏 */
    value: string;
  }

  export interface ListParams {
    /** 按 tag 过滤，为空则返回全部 */
    tag?: string;
  }
}

/**
 * 查询系统配置项列表（需要 admin 角色）
 */
export async function listSystemConfigsApi(
  params?: SystemConfigApi.ListParams,
) {
  return requestClient.get<SystemConfigApi.ItemInfo[]>('/system/configs', {
    params,
  });
}

/**
 * 查询单个配置项
 */
export async function getSystemConfigApi(key: string) {
  return requestClient.get<SystemConfigApi.ItemInfo>(
    `/system/configs/${encodeURIComponent(key)}`,
  );
}

/**
 * 写入配置项覆盖值
 */
export async function updateSystemConfigApi(key: string, value: string) {
  return requestClient.put<SystemConfigApi.ItemInfo>(
    `/system/configs/${encodeURIComponent(key)}`,
    { value },
  );
}

/**
 * 删除配置项覆盖值（恢复默认）
 */
export async function resetSystemConfigApi(key: string) {
  return requestClient.delete<SystemConfigApi.ItemInfo>(
    `/system/configs/${encodeURIComponent(key)}`,
  );
}

/**
 * 刷新系统配置缓存
 */
export async function refreshSystemConfigApi() {
  return requestClient.post<null>('/system/configs/refresh');
}

/**
 * 生成可粘贴到 application.properties 的配置行（text/plain）
 */
export async function getSystemConfigPropertiesApi(key: string) {
  return requestClient.get<string>(
    `/system/configs/${encodeURIComponent(key)}/properties`,
    { responseType: 'text' },
  );
}

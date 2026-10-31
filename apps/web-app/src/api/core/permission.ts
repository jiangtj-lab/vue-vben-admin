import { requestClient } from '#/api/request';

export namespace PermissionApi {
  /** 权限字典项（GET /permissions） */
  export interface Permission {
    /** 权限编码，如 book:read */
    code: string;
    id?: number;
    name: string;
  }

  export interface ListParams {
    /** 关键字，同时匹配权限编码与名称（忽略大小写） */
    keyword?: string;
  }
}

/**
 * 查询权限字典（仅 admin 角色可访问），按编码排序
 */
export async function listPermissionsApi(params?: PermissionApi.ListParams) {
  return requestClient.get<PermissionApi.Permission[]>('/permissions', {
    params,
  });
}

/**
 * 按编码查询权限（仅 admin 角色可访问）
 */
export async function getPermissionApi(code: string) {
  return requestClient.get<PermissionApi.Permission>(
    `/permissions/${encodeURIComponent(code)}`,
  );
}

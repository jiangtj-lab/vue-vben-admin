import type { JsonSchema, PageQuery, PageResult } from '#/types/openapi';

import { requestClient } from '#/api/request';

export namespace RoleApi {
  /** 角色详情（GET /roles/page、GET /roles/{id}） */
  export interface RoleDetail {
    /** 角色编码，全局唯一 */
    code: string;
    id: number;
    name: string;
    /** 绑定的权限编码 */
    permissionCodes: string[];
  }

  /** 角色新增/修改请求体（RoleForm） */
  export interface RoleForm {
    code: string;
    name: string;
    /**
     * 绑定的权限编码，必须存在于权限字典中；
     * 修改时整体覆盖，传空数组表示清空
     */
    permissionCodes?: string[];
  }

  /** 角色分页查询参数（RoleQuery + Spring Data 分页参数） */
  export interface RoleQuery extends PageQuery {
    /** 角色编码，精确匹配 */
    code?: string;
    /** 角色名称，模糊匹配（忽略大小写） */
    name?: string;
  }
}

/**
 * 分页查询角色（仅 admin 角色可访问）
 */
export async function pageRolesApi(params?: RoleApi.RoleQuery) {
  return requestClient.get<PageResult<RoleApi.RoleDetail>>('/roles/page', {
    params,
  });
}

/**
 * 查询单个角色（仅 admin 角色可访问）
 */
export async function getRoleApi(id: number) {
  return requestClient.get<RoleApi.RoleDetail>(`/roles/${id}`);
}

/**
 * 新增角色（仅 admin 角色可访问）
 */
export async function createRoleApi(data: RoleApi.RoleForm) {
  return requestClient.post<RoleApi.RoleDetail>('/roles', data);
}

/**
 * 修改角色（仅 admin 角色可访问，permissionCodes 整体覆盖）
 */
export async function updateRoleApi(id: number, data: RoleApi.RoleForm) {
  return requestClient.put<RoleApi.RoleDetail>(`/roles/${id}`, data);
}

/**
 * 删除角色（仅 admin 角色可访问，同时清理用户/权限关联）
 */
export async function deleteRoleApi(id: number) {
  return requestClient.delete<null>(`/roles/${id}`);
}

/**
 * 获取角色表单 JSON Schema，供前端动态生成新增/修改角色的表单
 */
export async function getRoleFormSchemaApi() {
  return requestClient.get<JsonSchema>('/roles/form-schema');
}

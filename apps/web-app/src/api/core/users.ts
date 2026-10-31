import type { JsonSchema, PageQuery, PageResult } from '#/types/openapi';

import { requestClient } from '#/api/request';

/**
 * 用户管理接口，对应 openapi/openapi.yaml 中的 UserController（/users、/users/{id}）
 * 仅 admin 角色可访问；密码只入不出，响应中不包含密码
 */
export namespace UserApi {
  /** 用户详情（GET /users/page、GET /users/{id}） */
  export interface UserDetail {
    /** 创建时间，形如 2026-10-31T10:00:00 */
    createTime: string;
    /** 是否启用，禁用后无法登录 */
    enabled: boolean;
    id: number;
    /** 昵称，提交时留空则回退为用户名 */
    nickname: string;
    /** 绑定的角色 id，按角色 id 升序 */
    roleIds: number[];
    /** 用户名，全局唯一，也是登录名与 JWT subject */
    username: string;
  }

  /** 用户详情分页结果（UserDetailPage） */
  export type UserDetailPage = PageResult<UserDetail>;

  /** 角色下拉选项（RoleOption，GET /users/roles） */
  export interface RoleOption {
    /** 角色编码，全局唯一 */
    code: string;
    /** 角色主键，用于筛选与 UserForm.roleIds */
    id: number;
    /** 角色名称，用于下拉框展示 */
    name: string;
  }

  /** 用户新增/修改请求体（UserForm） */
  export interface UserForm {
    enabled?: boolean;
    nickname?: null | string;
    /**
     * 明文密码，服务端 bcrypt 哈希后存储；
     * 新增时必填，修改时留空或传 null 表示保留原密码
     */
    password?: null | string;
    /**
     * 绑定的角色 id，必须存在于 sys_role 中；
     * 修改时整体覆盖，传空数组表示清空该用户的全部角色
     */
    roleIds?: number[];
    /** 用户名，全局唯一，仅支持字母、数字及 _ . - */
    username: string;
  }

  /** 用户分页查询参数（UserQuery + Spring Data 分页参数） */
  export interface UserQuery extends PageQuery {
    /** 是否启用，精确匹配 */
    enabled?: boolean;
    /** 昵称，模糊匹配（忽略大小写） */
    nickname?: string;
    /** 角色 id，精确匹配；取值来自 listUserRoleOptionsApi */
    roleId?: number;
    /** 用户名，精确匹配 */
    username?: string;
  }
}

/**
 * 分页查询用户（仅 admin 角色可访问）
 */
export async function pageUsersApi(params?: UserApi.UserQuery) {
  return requestClient.get<UserApi.UserDetailPage>('/users/page', { params });
}

/**
 * 查询单个用户（仅 admin 角色可访问）
 */
export async function getUserApi(id: number) {
  return requestClient.get<UserApi.UserDetail>(`/users/${id}`);
}

/**
 * 新增用户（仅 admin 角色可访问，password 必填）
 */
export async function createUserApi(data: UserApi.UserForm) {
  return requestClient.post<UserApi.UserDetail>('/users', data);
}

/**
 * 修改用户（仅 admin 角色可访问，roleIds 整体覆盖）
 */
export async function updateUserApi(id: number, data: UserApi.UserForm) {
  return requestClient.put<UserApi.UserDetail>(`/users/${id}`, data);
}

/**
 * 删除用户（仅 admin 角色可访问，同时清理用户角色关联）
 */
export async function deleteUserApi(id: number) {
  return requestClient.delete<null>(`/users/${id}`);
}

/**
 * 查询角色下拉选项（仅 admin 角色可访问）
 * 返回全量角色的 id/code/name，供用户列表的角色筛选框与表单的角色选择使用
 */
export async function listUserRoleOptionsApi() {
  return requestClient.get<UserApi.RoleOption[]>('/users/roles');
}

/**
 * 获取用户表单 JSON Schema，供前端动态生成新增/修改用户的表单
 */
export async function getUserFormSchemaApi() {
  return requestClient.get<JsonSchema>('/users/form-schema');
}

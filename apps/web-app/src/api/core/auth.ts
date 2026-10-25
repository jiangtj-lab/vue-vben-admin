import { requestClient } from '#/api/request';

export namespace AuthApi {
  /** 登录接口参数（POST /login） */
  export interface LoginParams {
    password?: string;
    username?: string;
  }

  /** 登录接口返回值（POST /login） */
  export interface LoginResult {
    /** 昵称 */
    nickname: string;
    /** 权限编码列表，如 book:* */
    permissions: string[];
    /** 角色编码列表，如 admin */
    roles: string[];
    /** 后续请求放入 Authorization: Bearer <token> */
    token: string;
    username: string;
  }

  /** 当前登录用户（GET /me） */
  export interface MeResult {
    nickname: string;
    permissions: string[];
    roles: string[];
    username: string;
  }
}

/**
 * 登录并签发 JWT
 */
export async function loginApi(data: AuthApi.LoginParams) {
  return requestClient.post<AuthApi.LoginResult>('/login', data);
}

/**
 * 获取当前登录用户（含角色与权限）
 */
export async function getCurrentUserApi() {
  return requestClient.get<AuthApi.MeResult>('/me');
}

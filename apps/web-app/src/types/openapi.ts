/**
 * demo-backend OpenAPI 文档（apps/web-app/openapi/openapi.yaml）中的公共结构
 */

/** RFC 7807 错误响应，后端统一以 application/problem+json 返回 */
export interface ProblemDetail {
  /** 具体错误说明，如「用户名或密码错误」 */
  detail?: string;
  /** 触发错误的请求路径 */
  instance?: string;
  /** HTTP 状态码 */
  status?: number;
  /** 简短标题，如 No Login / No Permission / No Role */
  title?: string;
  /** 问题类型 URI，内置异常为 about:blank */
  type?: string;
}

/** 分页元信息（Spring Data `PagedModel` 的 `page` 字段） */
export interface PageMeta {
  /** 当前页码，从 0 开始（请求参数 page 从 1 开始） */
  number: number;
  /** 每页条数 */
  size: number;
  /** 总记录数 */
  totalElements: number;
  /** 总页数 */
  totalPages: number;
}

/** 分页结果（BookPage、RoleDetailPage） */
export interface PageResult<T> {
  /** 当前页数据 */
  content: T[];
  page: PageMeta;
}

/** 分页查询参数 */
export interface PageQuery {
  /** 页码，从 1 开始 */
  page?: number;
  /** 每页条数，默认 20 */
  size?: number;
  /**
   * 排序条件，格式 `属性名[,asc|desc]`，属性名使用 pojo 的驼峰字段名；
   * 可重复传参表示多字段排序（数组会被序列化为多个同名参数）
   */
  sortQ?: string | string[];
}

/**
 * JSON Schema（draft 2020-12）常用关键字子集
 * 用于 `GET /books/form-schema` 的返回值，值为 null 的字段不会出现在响应中
 */
export interface JsonSchema {
  $schema?: string;
  additionalProperties?: JsonSchema;
  default?: unknown;
  deprecated?: boolean;
  description?: string;
  enum?: unknown[];
  exclusiveMaximum?: number;
  exclusiveMinimum?: number;
  format?: string;
  items?: JsonSchema;
  maximum?: number;
  maxItems?: number;
  maxLength?: number;
  minimum?: number;
  minItems?: number;
  minLength?: number;
  multipleOf?: number;
  pattern?: string;
  properties?: Record<string, JsonSchema>;
  required?: string[];
  title?: string;
  /** object / string / number / integer / boolean */
  type?: string;
}

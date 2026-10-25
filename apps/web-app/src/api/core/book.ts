import type { JsonSchema } from '#/types/openapi';

import { requestClient } from '#/api/request';

export namespace BookApi {
  /** 图书（GET /books、GET /books/{id}） */
  export interface Book {
    author: string;
    /** 创建时间，服务端 LocalDateTime 序列化结果 */
    createTime: string;
    id?: number;
    isbn?: string;
    price?: number;
    stock?: number;
    title: string;
  }

  /** 图书新增/修改请求体（BookForm） */
  export interface BookForm {
    author: string;
    isbn?: string;
    price: number;
    stock: number;
    title: string;
  }
}

/**
 * 查询图书列表
 */
export async function listBooksApi() {
  return requestClient.get<BookApi.Book[]>('/books');
}

/**
 * 查询单本图书
 */
export async function getBookApi(id: number) {
  return requestClient.get<BookApi.Book>(`/books/${id}`);
}

/**
 * 新增图书
 */
export async function createBookApi(data: BookApi.BookForm) {
  return requestClient.post<BookApi.Book>('/books', data);
}

/**
 * 修改图书（全量覆盖 title、author、isbn、price、stock）
 */
export async function updateBookApi(id: number, data: BookApi.BookForm) {
  return requestClient.put<BookApi.Book>(`/books/${id}`, data);
}

/**
 * 删除图书（需要 admin 角色）
 */
export async function deleteBookApi(id: number) {
  return requestClient.delete<null>(`/books/${id}`);
}

/**
 * 获取图书表单 JSON Schema，供前端动态生成表单
 */
export async function getBookFormSchemaApi() {
  return requestClient.get<JsonSchema>('/books/form-schema');
}

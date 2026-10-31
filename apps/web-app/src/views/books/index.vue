<script lang="ts" setup>
import type { VbenFormProps } from '#/adapter/form';
import type { VxeTableGridOptions } from '#/adapter/vxe-table';
import type { BookApi } from '#/api';
import type { JsonSchema } from '#/types/openapi';

import { nextTick, ref } from 'vue';

import { Page } from '@vben/common-ui';

import { ElButton, ElDialog, ElMessage, ElMessageBox } from 'element-plus';

import { useVbenForm } from '#/adapter/form';
import { useVbenVxeGrid } from '#/adapter/vxe-table';
import {
  createBookApi,
  deleteBookApi,
  getBookFormSchemaApi,
  pageBooksApi,
  updateBookApi,
} from '#/api';
import { jsonSchemaToFormSchema } from '#/utils/json-schema';

defineOptions({ name: 'BookManage' });

/** 后端 JSON Schema 只有字段名，这里补充中文标签 */
const BOOK_FIELD_LABELS: Record<string, string> = {
  author: '作者',
  isbn: 'ISBN',
  price: '价格',
  stock: '库存',
  title: '书名',
};

/** 表单 Schema 接口不可用时的兜底定义（与 openapi.yaml 中 example 一致） */
const FALLBACK_SCHEMA: JsonSchema = {
  properties: {
    author: { maxLength: 64, title: 'author', type: 'string' },
    isbn: { maxLength: 32, title: 'isbn', type: 'string' },
    price: { minimum: 0, title: 'price', type: 'number' },
    stock: { minimum: 0, title: 'stock', type: 'integer' },
    title: { maxLength: 128, title: 'title', type: 'string' },
  },
  required: ['title', 'author', 'price', 'stock'],
  type: 'object',
};

/** GET /books/page 的过滤条件（对应 BookQuery） */
interface BookSearchForm {
  author?: string;
  isbn?: string;
  maxPrice?: number;
  minPrice?: number;
  stock?: number;
  title?: string;
}

const formOptions: VbenFormProps<BookSearchForm> = {
  collapsed: false,
  schema: [
    {
      component: 'Input',
      componentProps: { clearable: true },
      fieldName: 'title',
      label: '书名',
    },
    {
      component: 'Input',
      componentProps: { clearable: true },
      fieldName: 'author',
      label: '作者',
    },
    {
      component: 'Input',
      componentProps: { clearable: true },
      fieldName: 'isbn',
      label: 'ISBN',
    },
    {
      component: 'InputNumber',
      componentProps: { class: 'w-full', min: 0 },
      fieldName: 'stock',
      label: '库存',
    },
    {
      component: 'InputNumber',
      componentProps: { class: 'w-full', min: 0 },
      fieldName: 'minPrice',
      label: '最低价',
    },
    {
      component: 'InputNumber',
      componentProps: { class: 'w-full', min: 0 },
      fieldName: 'maxPrice',
      label: '最高价',
    },
  ],
  showCollapseButton: true,
  submitOnEnter: true,
};

/** 去掉空值，避免把 undefined / 空串传给后端 */
function buildQueryParams(
  page: { currentPage: number; pageSize: number },
  formValues: BookSearchForm,
  sort?: { field?: string; order?: null | string },
): BookApi.BookQuery {
  const params: BookApi.BookQuery = {
    page: page.currentPage,
    size: page.pageSize,
  };
  for (const [key, value] of Object.entries(formValues ?? {})) {
    if (value === undefined || value === null || value === '') {
      continue;
    }
    (params as Record<string, unknown>)[key] = value;
  }
  if (sort?.field) {
    params.sortQ = `${sort.field},${sort.order === 'desc' ? 'desc' : 'asc'}`;
  }
  return params;
}

const gridOptions: VxeTableGridOptions<BookApi.Book> = {
  columns: [
    { title: '序号', type: 'seq', width: 60 },
    { field: 'title', minWidth: 200, title: '书名' },
    { field: 'author', minWidth: 140, title: '作者' },
    { field: 'isbn', minWidth: 160, title: 'ISBN' },
    {
      field: 'price',
      slots: { default: 'price' },
      sortable: true,
      title: '价格',
      width: 120,
    },
    {
      align: 'center',
      field: 'stock',
      sortable: true,
      title: '库存',
      width: 100,
    },
    {
      field: 'createTime',
      formatter: 'formatDateTime',
      minWidth: 180,
      sortable: true,
      title: '创建时间',
    },
    {
      fixed: 'right',
      slots: { default: 'action' },
      title: '操作',
      width: 150,
    },
  ],
  height: 'auto',
  pagerConfig: {},
  proxyConfig: {
    ajax: {
      query: async ({ page, sort }, formValues) => {
        const result = await pageBooksApi(
          buildQueryParams(page, formValues, sort),
        );
        return {
          items: result.content ?? [],
          total: result.page?.totalElements ?? 0,
        };
      },
    },
  },
  sortConfig: { remote: true },
  toolbarConfig: { custom: true, refresh: true, search: true, zoom: true },
};

const [Grid, gridApi] = useVbenVxeGrid<BookApi.Book, BookSearchForm>({
  formOptions,
  gridOptions,
});

const dialogVisible = ref(false);
const editingId = ref<null | number>(null);
const submitting = ref(false);

const [Form, formApi] = useVbenForm({
  commonConfig: { componentProps: { class: 'w-full' } },
  layout: 'vertical',
  schema: [],
  showDefaultActions: false,
});

let schemaLoaded = false;

/** 动态表单：使用 GET /books/form-schema 返回的 JSON Schema 生成 */
async function ensureFormSchema() {
  if (schemaLoaded) {
    return;
  }
  let schema = FALLBACK_SCHEMA;
  try {
    schema = await getBookFormSchemaApi();
  } catch {
    // 接口不可用时使用兜底 schema，错误提示已由请求拦截器给出
  }
  formApi.setState({
    schema: jsonSchemaToFormSchema(schema, { labels: BOOK_FIELD_LABELS }),
  });
  schemaLoaded = true;
}

async function openDialog(row?: BookApi.Book) {
  await ensureFormSchema();
  editingId.value = row?.id ?? null;
  dialogVisible.value = true;
  await nextTick();
  await formApi.reset();
  if (row) {
    await formApi.setValues({
      author: row.author,
      isbn: row.isbn ?? '',
      price: row.price ?? 0,
      stock: row.stock ?? 0,
      title: row.title,
    });
  }
}

async function handleSubmit() {
  const values = await formApi.validateAndSubmit();
  if (!values) {
    return;
  }
  submitting.value = true;
  try {
    const payload = values as unknown as BookApi.BookForm;
    if (editingId.value) {
      await updateBookApi(editingId.value, payload);
      ElMessage.success('修改成功');
    } else {
      await createBookApi(payload);
      ElMessage.success('新增成功');
    }
    dialogVisible.value = false;
    await gridApi.query();
  } finally {
    submitting.value = false;
  }
}

async function handleDelete(row: BookApi.Book) {
  try {
    await ElMessageBox.confirm(`确认删除《${row.title}》？`, '提示', {
      confirmButtonText: '删除',
      type: 'warning',
    });
  } catch {
    return;
  }
  if (!row.id) {
    return;
  }
  await deleteBookApi(row.id);
  ElMessage.success('删除成功');
  await gridApi.query();
}
</script>

<template>
  <Page
    auto-content-height
    description="对接 demo-backend 的 /books/page 分页接口：条件查询、排序、新增、修改、删除，编辑表单由 /books/form-schema 动态生成。"
    title="图书管理"
  >
    <Grid table-title="图书列表">
      <template #toolbar-tools>
        <ElButton
          v-access:code="'book:write'"
          type="primary"
          @click="openDialog()"
        >
          新增图书
        </ElButton>
      </template>
      <template #price="{ row }">
        {{
          row.price === null || row.price === undefined
            ? '-'
            : Number(row.price).toFixed(2)
        }}
      </template>
      <template #action="{ row }">
        <ElButton
          v-access:code="'book:write'"
          link
          type="primary"
          @click="openDialog(row)"
        >
          编辑
        </ElButton>
        <ElButton
          v-access:role="'admin'"
          link
          type="danger"
          @click="handleDelete(row)"
        >
          删除
        </ElButton>
      </template>
    </Grid>

    <ElDialog
      v-model="dialogVisible"
      :close-on-click-modal="false"
      :title="editingId ? '编辑图书' : '新增图书'"
      width="560px"
    >
      <Form />
      <template #footer>
        <ElButton @click="dialogVisible = false">取消</ElButton>
        <ElButton :loading="submitting" type="primary" @click="handleSubmit">
          保存
        </ElButton>
      </template>
    </ElDialog>
  </Page>
</template>

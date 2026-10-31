<script lang="ts" setup>
import type { VbenFormProps } from '#/adapter/form';
import type { VxeTableGridOptions } from '#/adapter/vxe-table';
import type { UserApi } from '#/api';
import type { JsonSchema } from '#/types/openapi';

import { nextTick, onMounted, ref } from 'vue';

import { Page } from '@vben/common-ui';

import {
  ElButton,
  ElDialog,
  ElMessage,
  ElMessageBox,
  ElTag,
} from 'element-plus';

import { useVbenForm, z } from '#/adapter/form';
import { useVbenVxeGrid } from '#/adapter/vxe-table';
import {
  createUserApi,
  deleteUserApi,
  getUserFormSchemaApi,
  listUserRoleOptionsApi,
  pageUsersApi,
  updateUserApi,
} from '#/api';
import { jsonSchemaToFormSchema } from '#/utils/json-schema';

defineOptions({ name: 'SystemUser' });

/** 后端 JSON Schema 只有字段名，这里补充中文标签 */
const USER_FIELD_LABELS: Record<string, string> = {
  enabled: '是否启用',
  nickname: '昵称',
  password: '密码',
  roleIds: '角色',
  username: '用户名',
};

/** 表单 Schema 接口不可用时的兜底定义（与 openapi.yaml 中 example 一致） */
const FALLBACK_USER_FORM_SCHEMA: JsonSchema = {
  properties: {
    username: {
      maxLength: 64,
      minLength: 1,
      pattern: '^[A-Za-z0-9_.-]+$',
      type: 'string',
    },
    password: {
      format: 'password',
      maxLength: 64,
      minLength: 6,
      type: 'string',
    },
    nickname: { maxLength: 64, type: 'string' },
    enabled: { default: true, type: 'boolean' },
    roleIds: { items: { type: 'integer' }, type: 'array' },
  },
  required: ['username', 'enabled', 'roleIds'],
  type: 'object',
};

interface UserSearchForm {
  /** 是否启用，精确匹配 */
  enabled?: boolean;
  /** 昵称，模糊匹配 */
  nickname?: string;
  /** 角色 id，精确匹配（筛选框） */
  roleId?: number;
  /** 用户名，精确匹配 */
  username?: string;
}

interface UserFormValues {
  enabled: boolean;
  nickname?: string;
  password?: string;
  roleIds: number[];
  username: string;
}

/** 新增时密码必填；修改时留空表示保留原密码 */
function passwordRules(editing: boolean) {
  if (editing) {
    return z
      .union([
        z.literal(''),
        z.string().min(6, { message: '密码至少 6 个字符' }),
      ])
      .optional();
  }
  return z
    .string()
    .min(6, { message: '密码至少 6 个字符' })
    .max(64, { message: '最多 64 个字符' });
}

/** 把服务端 LocalDateTime（2026-10-31T10:00:00）格式化为可读文本 */
function formatDateTime(value?: string) {
  return value ? value.replace('T', ' ').slice(0, 19) : '-';
}

const formOptions: VbenFormProps<UserSearchForm> = {
  collapsed: false,
  schema: [
    {
      component: 'Input',
      componentProps: { clearable: true },
      fieldName: 'username',
      label: '用户名',
    },
    {
      component: 'Input',
      componentProps: { clearable: true },
      fieldName: 'nickname',
      label: '昵称',
    },
    {
      component: 'Select',
      componentProps: {
        clearable: true,
        filterable: true,
        options: [],
        placeholder: '全部角色',
      },
      fieldName: 'roleId',
      label: '角色',
    },
    {
      component: 'Select',
      componentProps: {
        clearable: true,
        options: [
          { label: '启用', value: true },
          { label: '禁用', value: false },
        ],
      },
      fieldName: 'enabled',
      label: '状态',
    },
  ],
  showCollapseButton: false,
  submitOnEnter: true,
};

const gridOptions: VxeTableGridOptions<UserApi.UserDetail> = {
  columns: [
    { title: '序号', type: 'seq', width: 60 },
    { align: 'center', field: 'id', title: 'ID', width: 80 },
    { field: 'username', minWidth: 140, sortable: true, title: '用户名' },
    { field: 'nickname', minWidth: 140, title: '昵称' },
    {
      align: 'center',
      field: 'enabled',
      slots: { default: 'enabled' },
      title: '状态',
      width: 100,
    },
    {
      field: 'roleIds',
      minWidth: 220,
      slots: { default: 'roles' },
      title: '角色',
    },
    {
      field: 'createTime',
      formatter: ({ cellValue }) => formatDateTime(cellValue),
      title: '创建时间',
      width: 180,
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
        const params: UserApi.UserQuery = {
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
        const result = await pageUsersApi(params);
        return {
          items: result.content ?? [],
          total: result.page?.totalElements ?? 0,
        };
      },
    },
  },
  rowConfig: { keyField: 'id' },
  sortConfig: { remote: true },
  toolbarConfig: { custom: true, refresh: true, search: true, zoom: true },
};

const [Grid, gridApi] = useVbenVxeGrid<UserApi.UserDetail, UserSearchForm>({
  formOptions,
  gridOptions,
});

const dialogVisible = ref(false);
const editingId = ref<null | number>(null);
const submitting = ref(false);

const [Form, formApi] = useVbenForm<UserFormValues>({
  commonConfig: { componentProps: { class: 'w-full' } },
  layout: 'vertical',
  schema: [],
  showDefaultActions: false,
});

/** 角色 id -> 角色名称，用于列表标签展示 */
const roleNameMap = ref<Record<number, string>>({});
/** 角色下拉选项，供筛选框与用户绑定角色复用 */
const roleOptions = ref<Array<{ label: string; value: number }>>([]);
let roleOptionsPromise: null | Promise<UserApi.RoleOption[]> = null;

/** 加载角色下拉选项（GET /users/roles），失败后允许下次重试 */
function ensureRoleOptions() {
  roleOptionsPromise ??= listUserRoleOptionsApi()
    .then((roles) => {
      const list = roles ?? [];
      roleOptions.value = list.map((role) => ({
        label: role.name,
        value: role.id,
      }));
      roleNameMap.value = Object.fromEntries(
        list.map((role) => [role.id, role.name]),
      );
      // 筛选框与编辑表单通过 updateSchema 注入选项，避免 schema 中残留空数组
      gridApi.formApi.updateSchema([
        {
          fieldName: 'roleId',
          componentProps: { options: roleOptions.value },
        },
      ]);
      formApi.updateSchema([
        {
          fieldName: 'roleIds',
          componentProps: { options: roleOptions.value },
        },
      ]);
      return list;
    })
    .catch((error) => {
      roleOptionsPromise = null;
      throw error;
    });
  return roleOptionsPromise;
}

let formSchemaLoaded = false;

/** 动态表单：使用 GET /users/form-schema 返回的 JSON Schema 生成 */
async function ensureFormSchema() {
  if (formSchemaLoaded) {
    return;
  }
  let schema = FALLBACK_USER_FORM_SCHEMA;
  try {
    schema = await getUserFormSchemaApi();
  } catch {
    // 接口不可用时使用兜底 schema，错误提示已由请求拦截器给出
  }
  formApi.setState({
    schema: jsonSchemaToFormSchema<UserFormValues>(schema, {
      fields: {
        password: {
          componentProps: {
            autocomplete: 'new-password',
            showPassword: true,
            type: 'password',
          },
        },
        roleIds: {
          componentProps: {
            collapseTags: true,
            collapseTagsTooltip: true,
            filterable: true,
            options: roleOptions.value,
            placeholder: '请选择角色（可多选）',
          },
        },
      },
      labels: USER_FIELD_LABELS,
    }),
  });
  formSchemaLoaded = true;
}

onMounted(() => {
  // 列表角色标签与筛选框都需要角色选项，加载失败时降级为展示角色 id
  ensureRoleOptions().catch(() => {});
});

async function openDialog(row?: UserApi.UserDetail) {
  // 角色加载失败不阻塞表单，角色下拉降级为空
  await ensureRoleOptions().catch(() => {});
  await ensureFormSchema();
  editingId.value = row?.id ?? null;
  // JSON Schema 里 password 非必填，新增场景需要前端补充必填校验
  formApi.updateSchema([
    { fieldName: 'password', rules: passwordRules(Boolean(editingId.value)) },
  ]);
  dialogVisible.value = true;
  await nextTick();
  await formApi.reset();
  await formApi.setValues({
    enabled: row?.enabled ?? true,
    nickname: row?.nickname ?? '',
    password: '',
    roleIds: row?.roleIds ?? [],
    username: row?.username ?? '',
  });
}

async function handleSubmit() {
  const values = await formApi.validateAndSubmit();
  if (!values) {
    return;
  }
  const payload: UserApi.UserForm = {
    enabled: values.enabled,
    nickname: values.nickname ?? '',
    roleIds: values.roleIds ?? [],
    username: values.username,
  };
  // 修改时密码留空表示保留原密码
  if (values.password) {
    payload.password = values.password;
  }
  submitting.value = true;
  try {
    if (editingId.value) {
      await updateUserApi(editingId.value, payload);
      ElMessage.success('修改成功');
    } else {
      await createUserApi(payload);
      ElMessage.success('新增成功');
    }
    dialogVisible.value = false;
    await gridApi.query();
  } finally {
    submitting.value = false;
  }
}

async function handleDelete(row: UserApi.UserDetail) {
  try {
    await ElMessageBox.confirm(
      `确认删除用户「${row.username}」？该用户的角色关联也会一并清理。`,
      '提示',
      { confirmButtonText: '删除', type: 'warning' },
    );
  } catch {
    return;
  }
  await deleteUserApi(row.id);
  ElMessage.success('删除成功');
  await gridApi.query();
}
</script>

<template>
  <Page
    auto-content-height
    description="对接 demo-backend 的 /users 接口：分页查询（按角色筛选）、新增、修改、删除，表单由 /users/form-schema 动态生成（仅 admin 角色可见）。"
    title="用户管理"
  >
    <Grid table-title="用户列表">
      <template #toolbar-tools>
        <ElButton type="primary" @click="openDialog()">新增用户</ElButton>
      </template>
      <template #enabled="{ row }">
        <ElTag :type="row.enabled ? 'success' : 'info'" size="small">
          {{ row.enabled ? '启用' : '禁用' }}
        </ElTag>
      </template>
      <template #roles="{ row }">
        <div class="flex flex-wrap justify-center gap-1">
          <ElTag
            v-for="roleId in row.roleIds ?? []"
            :key="roleId"
            size="small"
            type="primary"
          >
            {{ roleNameMap[roleId] ?? `角色 #${roleId}` }}
          </ElTag>
          <span
            v-if="!row.roleIds || row.roleIds.length === 0"
            class="text-muted-foreground text-xs"
          >
            无角色
          </span>
        </div>
      </template>
      <template #action="{ row }">
        <ElButton link type="primary" @click="openDialog(row)">编辑</ElButton>
        <ElButton link type="danger" @click="handleDelete(row)">删除</ElButton>
      </template>
    </Grid>

    <ElDialog
      v-model="dialogVisible"
      :close-on-click-modal="false"
      :title="editingId ? '编辑用户' : '新增用户'"
      width="640px"
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

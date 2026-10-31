<script lang="ts" setup>
import type { VbenFormProps } from '#/adapter/form';
import type { VxeTableGridOptions } from '#/adapter/vxe-table';
import type { RoleApi, UserApi } from '#/api';

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
  pageRolesApi,
  pageUsersApi,
  updateUserApi,
} from '#/api';

defineOptions({ name: 'SystemUser' });

/** 用户名允许的字符（与 UserForm 的 @Pattern 一致） */
const USERNAME_PATTERN = /^[A-Za-z0-9_.-]+$/;
/** 一次性拉取的角色数量，用于角色下拉与列表角色名称展示 */
const ROLE_FETCH_SIZE = 200;

interface UserSearchForm {
  /** 是否启用，精确匹配 */
  enabled?: boolean;
  /** 昵称，模糊匹配 */
  nickname?: string;
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

/** 角色 id -> 角色名称，用于列表标签展示 */
const roleNameMap = ref<Record<number, string>>({});
/** 角色下拉选项，供用户绑定角色 */
const roleOptions = ref<Array<{ label: string; value: number }>>([]);
let roleOptionsPromise: null | Promise<void> = null;

/** 加载角色列表；接口只有分页版本，一次性取足够多的数据并复用请求 */
function ensureRoleOptions() {
  roleOptionsPromise ??= pageRolesApi({ page: 1, size: ROLE_FETCH_SIZE })
    .then((result) => {
      const roles: RoleApi.RoleDetail[] = result.content ?? [];
      roleOptions.value = roles.map((role) => ({
        label: role.name,
        value: role.id,
      }));
      roleNameMap.value = Object.fromEntries(
        roles.map((role) => [role.id, role.name]),
      );
      // 角色下拉通过 updateSchema 注入，避免表单 schema 中残留 ref 导致选项不刷新
      formApi.updateSchema([
        {
          fieldName: 'roleIds',
          componentProps: { options: roleOptions.value },
        },
      ]);
    })
    .catch((error) => {
      // 失败后允许下次重试
      roleOptionsPromise = null;
      throw error;
    });
  return roleOptionsPromise;
}

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

onMounted(() => {
  // 列表角色标签需要名称，加载失败时降级为展示角色 id
  ensureRoleOptions().catch(() => {});
});

const dialogVisible = ref(false);
const editingId = ref<null | number>(null);
const submitting = ref(false);

const [Form, formApi] = useVbenForm<UserFormValues>({
  commonConfig: { componentProps: { class: 'w-full' } },
  layout: 'vertical',
  schema: [
    {
      component: 'Input',
      componentProps: { clearable: true, maxlength: 64 },
      fieldName: 'username',
      help: '全局唯一，同时作为登录名；仅支持字母、数字及 _ . -',
      label: '用户名',
      rules: z
        .string()
        .min(1, { message: '请输入用户名' })
        .max(64, { message: '最多 64 个字符' })
        .regex(USERNAME_PATTERN, { message: '仅支持字母、数字及 _ . -' }),
    },
    {
      component: 'Input',
      componentProps: {
        autocomplete: 'new-password',
        clearable: true,
        maxlength: 64,
        showPassword: true,
        type: 'password',
      },
      fieldName: 'password',
      help: '新增时必填；修改时留空表示保留原密码',
      label: '密码',
      rules: passwordRules(false),
    },
    {
      component: 'Input',
      componentProps: { clearable: true, maxlength: 64 },
      fieldName: 'nickname',
      help: '留空时使用用户名',
      label: '昵称',
    },
    {
      component: 'Switch',
      componentProps: { class: 'mb-0' },
      defaultValue: true,
      fieldName: 'enabled',
      help: '禁用后无法登录',
      label: '是否启用',
    },
    {
      component: 'Select',
      componentProps: {
        clearable: true,
        filterable: true,
        mode: 'multiple',
        options: [],
        placeholder: '请选择角色',
      },
      fieldName: 'roleIds',
      help: '整体覆盖该用户的角色绑定，不选表示清空',
      label: '角色',
    },
  ],
  showDefaultActions: false,
});

async function openDialog(row?: UserApi.UserDetail) {
  // 角色加载失败不阻塞表单，角色下拉降级为空
  await ensureRoleOptions().catch(() => {});
  editingId.value = row?.id ?? null;
  await formApi.updateSchema([
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
    description="对接 demo-backend 的 /users 接口：分页查询、新增、修改、删除，并为用户绑定角色（仅 admin 角色可见）。"
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

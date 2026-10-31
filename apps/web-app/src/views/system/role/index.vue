<script lang="ts" setup>
import type { VbenFormProps } from '#/adapter/form';
import type { VxeTableGridOptions } from '#/adapter/vxe-table';
import type { RoleApi } from '#/api';
import type { PermissionTreeNode } from '#/utils/permission';

import { nextTick, onMounted, ref } from 'vue';

import { Page } from '@vben/common-ui';

import {
  ElButton,
  ElDialog,
  ElMessage,
  ElMessageBox,
  ElTag,
  ElTree,
} from 'element-plus';

import { useVbenForm, z } from '#/adapter/form';
import { useVbenVxeGrid } from '#/adapter/vxe-table';
import {
  createRoleApi,
  deleteRoleApi,
  listPermissionsApi,
  pageRolesApi,
  updateRoleApi,
} from '#/api';
import { buildPermissionTree, isPermissionGroup } from '#/utils/permission';

defineOptions({ name: 'RoleManage' });

/** 角色编码允许的字符（与 RoleForm 的 @Pattern 一致） */
const CODE_PATTERN = /^[A-Za-z0-9_.:-]+$/;

interface RoleSearchForm {
  /** 角色编码，精确匹配 */
  code?: string;
  /** 角色名称，模糊匹配 */
  name?: string;
}

const formOptions: VbenFormProps<RoleSearchForm> = {
  collapsed: false,
  schema: [
    {
      component: 'Input',
      componentProps: { clearable: true },
      fieldName: 'code',
      label: '角色编码',
    },
    {
      component: 'Input',
      componentProps: { clearable: true },
      fieldName: 'name',
      label: '角色名称',
    },
  ],
  showCollapseButton: false,
  submitOnEnter: true,
};

const gridOptions: VxeTableGridOptions<RoleApi.RoleDetail> = {
  columns: [
    { title: '序号', type: 'seq', width: 60 },
    { align: 'center', field: 'id', title: 'ID', width: 80 },
    { field: 'code', minWidth: 140, sortable: true, title: '角色编码' },
    { field: 'name', minWidth: 140, sortable: true, title: '角色名称' },
    {
      field: 'permissionCodes',
      minWidth: 260,
      slots: { default: 'permissions' },
      title: '权限',
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
        const params: RoleApi.RoleQuery = {
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
        const result = await pageRolesApi(params);
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

const [Grid, gridApi] = useVbenVxeGrid<RoleApi.RoleDetail, RoleSearchForm>({
  formOptions,
  gridOptions,
});

/** 权限树，供角色绑定权限时勾选 */
const permissionTree = ref<PermissionTreeNode[]>([]);
/** 权限编码 -> 权限名称，用于列表标签展示 */
const permissionNameMap = ref<Record<string, string>>({});
let permissionTreePromise: null | Promise<PermissionTreeNode[]> = null;

/** 加载权限字典并按 `:` 分层构建成树，重复调用复用同一个请求 */
function ensurePermissionTree() {
  permissionTreePromise ??= listPermissionsApi()
    .then((list) => {
      permissionNameMap.value = Object.fromEntries(
        (list ?? []).map((item) => [item.code, item.name]),
      );
      permissionTree.value = buildPermissionTree(list ?? []);
      return permissionTree.value;
    })
    .catch((error) => {
      // 失败后允许下次重试
      permissionTreePromise = null;
      throw error;
    });
  return permissionTreePromise;
}

onMounted(() => {
  // 列表标签需要权限名称，加载失败时降级为直接展示权限编码
  ensurePermissionTree().catch(() => {});
});

const dialogVisible = ref(false);
const editingId = ref<null | number>(null);
const submitting = ref(false);

const [Form, formApi] = useVbenForm({
  commonConfig: { componentProps: { class: 'w-full' } },
  layout: 'vertical',
  schema: [
    {
      component: 'Input',
      componentProps: { clearable: true, maxlength: 64 },
      fieldName: 'code',
      help: '角色编码全局唯一，用于 @HasRole 鉴权',
      label: '角色编码',
      rules: z
        .string()
        .min(1, { message: '请输入角色编码' })
        .max(64, { message: '最多 64 个字符' })
        .regex(CODE_PATTERN, { message: '仅支持字母、数字及 _ . : -' }),
    },
    {
      component: 'Input',
      componentProps: { clearable: true, maxlength: 64 },
      fieldName: 'name',
      label: '角色名称',
      rules: z
        .string()
        .min(1, { message: '请输入角色名称' })
        .max(64, { message: '最多 64 个字符' }),
    },
  ],
  showDefaultActions: false,
});

const treeRef = ref<InstanceType<typeof ElTree>>();
/** 待回显的已勾选权限，等弹窗内的树渲染完成后再设置 */
const pendingCheckedCodes = ref<string[]>([]);

async function openDialog(row?: RoleApi.RoleDetail) {
  await ensurePermissionTree();
  editingId.value = row?.id ?? null;
  // 分组节点只用于整组勾选，回显时忽略，避免连带勾选整组权限
  pendingCheckedCodes.value = (row?.permissionCodes ?? []).filter(
    (code) => !isPermissionGroup(code),
  );
  dialogVisible.value = true;
  await nextTick();
  await formApi.reset();
  if (row) {
    await formApi.setValues({ code: row.code, name: row.name });
  }
}

/** 弹窗打开后再回填勾选状态，确保树已渲染 */
function handleDialogOpened() {
  treeRef.value?.setCheckedKeys(pendingCheckedCodes.value);
}

async function handleSubmit() {
  const values = await formApi.validateAndSubmit();
  if (!values) {
    return;
  }
  submitting.value = true;
  try {
    const formValues = values as unknown as RoleApi.RoleForm;
    // 分组节点仅用于整组勾选，只提交具体权限点
    const permissionCodes = (treeRef.value?.getCheckedKeys() ?? [])
      .map(String)
      .filter((code) => !isPermissionGroup(code));
    const payload: RoleApi.RoleForm = {
      code: formValues.code,
      name: formValues.name,
      permissionCodes,
    };
    if (editingId.value) {
      await updateRoleApi(editingId.value, payload);
      ElMessage.success('修改成功');
    } else {
      await createRoleApi(payload);
      ElMessage.success('新增成功');
    }
    dialogVisible.value = false;
    await gridApi.query();
  } finally {
    submitting.value = false;
  }
}

async function handleDelete(row: RoleApi.RoleDetail) {
  try {
    await ElMessageBox.confirm(
      `确认删除角色「${row.name}」？关联的用户角色与角色权限也会一并清理。`,
      '提示',
      { confirmButtonText: '删除', type: 'warning' },
    );
  } catch {
    return;
  }
  await deleteRoleApi(row.id);
  ElMessage.success('删除成功');
  await gridApi.query();
}
</script>

<template>
  <Page
    auto-content-height
    description="对接 demo-backend 的 /roles 接口：分页查询、新增、修改、删除，并为角色绑定权限字典中的权限编码（仅 admin 角色可见）。"
    title="角色管理"
  >
    <Grid table-title="角色列表">
      <template #toolbar-tools>
        <ElButton type="primary" @click="openDialog()">新增角色</ElButton>
      </template>
      <template #permissions="{ row }">
        <div class="flex flex-wrap justify-center gap-1">
          <ElTag
            v-for="code in row.permissionCodes ?? []"
            :key="code"
            :title="code"
            :type="isPermissionGroup(code) ? 'primary' : 'info'"
            size="small"
          >
            {{ permissionNameMap[code] ?? code }}
          </ElTag>
          <span
            v-if="!row.permissionCodes || row.permissionCodes.length === 0"
            class="text-muted-foreground text-xs"
          >
            无权限
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
      :title="editingId ? '编辑角色' : '新增角色'"
      width="640px"
      @opened="handleDialogOpened"
    >
      <Form />
      <div class="mt-4 flex flex-col gap-2">
        <div class="flex flex-wrap items-center justify-between gap-2">
          <span class="text-sm font-medium">权限</span>
          <span class="text-muted-foreground text-xs">
            勾选分组节点可整组授权，提交时仅保存具体权限点
          </span>
        </div>
        <div
          class="border-border max-h-[320px] overflow-auto rounded border p-2"
        >
          <ElTree
            ref="treeRef"
            :data="permissionTree"
            :props="{ children: 'children', label: 'name' }"
            default-expand-all
            empty-text="暂无权限字典"
            node-key="code"
            show-checkbox
          >
            <template #default="{ data }">
              <span class="flex items-center gap-2">
                <span>{{ data.name }}</span>
                <span class="text-muted-foreground font-mono text-xs">
                  {{ data.code }}
                </span>
              </span>
            </template>
          </ElTree>
        </div>
        <span class="text-muted-foreground text-xs">
          修改时整体覆盖，全部取消勾选表示清空该角色的权限
        </span>
      </div>
      <template #footer>
        <ElButton @click="dialogVisible = false">取消</ElButton>
        <ElButton :loading="submitting" type="primary" @click="handleSubmit">
          保存
        </ElButton>
      </template>
    </ElDialog>
  </Page>
</template>

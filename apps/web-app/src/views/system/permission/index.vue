<script lang="ts" setup>
import type { VbenFormProps } from '#/adapter/form';
import type { VxeTableGridOptions } from '#/adapter/vxe-table';
import type { PermissionTreeNode } from '#/utils/permission';

import { Page } from '@vben/common-ui';

import { ElTag } from 'element-plus';

import { useVbenVxeGrid } from '#/adapter/vxe-table';
import { listPermissionsApi } from '#/api';
import { buildPermissionTree, isPermissionGroup } from '#/utils/permission';

defineOptions({ name: 'PermissionList' });

interface PermissionSearchForm {
  /** 关键字，同时匹配权限编码与名称 */
  keyword?: string;
}

const formOptions: VbenFormProps<PermissionSearchForm> = {
  collapsed: false,
  schema: [
    {
      component: 'Input',
      componentProps: { clearable: true, placeholder: '匹配权限编码或名称' },
      fieldName: 'keyword',
      label: '关键字',
    },
  ],
  showCollapseButton: false,
  submitOnEnter: true,
};

const gridOptions: VxeTableGridOptions<PermissionTreeNode> = {
  columns: [
    {
      field: 'code',
      minWidth: 260,
      title: '权限编码',
      treeNode: true,
    },
    {
      field: 'name',
      minWidth: 240,
      slots: { default: 'name' },
      title: '权限名称',
    },
    { align: 'center', field: 'id', title: 'ID', width: 80 },
  ],
  height: 'auto',
  // 接口一次返回全部匹配数据，无需分页
  pagerConfig: { enabled: false },
  proxyConfig: {
    ajax: {
      query: async (_params, formValues) => {
        const list = await listPermissionsApi({
          keyword: formValues?.keyword || undefined,
        });
        // 接口返回扁平列表，编码以 `:` 分层，前端组装成树
        return {
          items: buildPermissionTree(list ?? []),
          total: list?.length ?? 0,
        };
      },
    },
  },
  rowConfig: { keyField: 'code' },
  treeConfig: {
    childrenField: 'children',
    expandAll: true,
    rowField: 'code',
    showLine: true,
  },
  toolbarConfig: { custom: true, refresh: true, search: true, zoom: true },
};

const [Grid] = useVbenVxeGrid<PermissionTreeNode, PermissionSearchForm>({
  formOptions,
  gridOptions,
});
</script>

<template>
  <Page
    auto-content-height
    description="对接 demo-backend 的 /permissions 接口：按关键字查询权限字典，并按编码的 `:` 分层渲染为权限树（不含 `:` 的编码为分组节点，仅 admin 角色可见）。"
    title="权限字典"
  >
    <Grid table-title="权限树">
      <template #name="{ row }">
        <span class="flex items-center gap-2">
          <span>{{ row.name }}</span>
          <ElTag v-if="isPermissionGroup(row.code)" size="small">分组</ElTag>
        </span>
      </template>
    </Grid>
  </Page>
</template>

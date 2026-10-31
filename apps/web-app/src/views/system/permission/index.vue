<script lang="ts" setup>
import type { VbenFormProps } from '#/adapter/form';
import type { VxeTableGridOptions } from '#/adapter/vxe-table';
import type { PermissionApi } from '#/api';

import { Page } from '@vben/common-ui';

import { useVbenVxeGrid } from '#/adapter/vxe-table';
import { listPermissionsApi } from '#/api';

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

const gridOptions: VxeTableGridOptions<PermissionApi.Permission> = {
  columns: [
    { title: '序号', type: 'seq', width: 60 },
    { align: 'center', field: 'id', title: 'ID', width: 80 },
    { field: 'code', minWidth: 200, title: '权限编码' },
    { field: 'name', minWidth: 200, title: '权限名称' },
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
        return { items: list ?? [], total: list?.length ?? 0 };
      },
    },
  },
  toolbarConfig: { custom: true, refresh: true, search: true, zoom: true },
};

const [Grid] = useVbenVxeGrid<PermissionApi.Permission, PermissionSearchForm>({
  formOptions,
  gridOptions,
});
</script>

<template>
  <Page
    auto-content-height
    description="对接 demo-backend 的 /permissions 接口：按关键字查询权限字典（由 db/migration/R__sys_permission.sql 维护，仅 admin 角色可见）。"
    title="权限字典"
  >
    <Grid table-title="权限列表" />
  </Page>
</template>

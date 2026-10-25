<script lang="ts" setup>
import type { SystemConfigApi } from '#/api';

import { computed, onMounted, ref, watch } from 'vue';

import { Page } from '@vben/common-ui';

import {
  ElButton,
  ElCollapse,
  ElCollapseItem,
  ElDialog,
  ElEmpty,
  ElInput,
  ElMessage,
  ElMessageBox,
  ElOption,
  ElSelect,
  ElSwitch,
  ElTag,
} from 'element-plus';

import {
  getSystemConfigPropertiesApi,
  listSystemConfigsApi,
  refreshSystemConfigApi,
  resetSystemConfigApi,
  updateSystemConfigApi,
} from '#/api';

defineOptions({ name: 'SystemConfig' });

/** 全量配置项，仅在初始化与重新加载时获取 */
const items = ref<SystemConfigApi.ItemInfo[]>([]);
const loading = ref(false);
/** 本地过滤关键字：同时匹配 key、名称、描述、tag */
const keyword = ref('');
const activeGroups = ref<string[]>([]);

/** 本地过滤后的配置项 */
const filteredItems = computed(() => {
  const text = keyword.value.trim().toLowerCase();
  if (!text) {
    return items.value;
  }
  return items.value.filter((item) =>
    [item.key, item.name, item.description, ...(item.tag ?? [])].some((field) =>
      (field ?? '').toLowerCase().includes(text),
    ),
  );
});

/** 按 group.order、order 排序分组 */
const groups = computed(() => {
  const map = new Map<
    string,
    { items: SystemConfigApi.ItemInfo[]; name: string; order: number }
  >();
  for (const item of filteredItems.value) {
    const name = item.group?.name ?? '未分组';
    if (!map.has(name)) {
      map.set(name, { items: [], name, order: item.group?.order ?? 0 });
    }
    map.get(name)?.items.push(item);
  }
  return [...map.values()]
    .toSorted((a, b) => a.order - b.order)
    .map((group) => ({
      ...group,
      items: group.items.toSorted((a, b) => a.order - b.order),
    }));
});

/** 当前可见（含过滤后）的全部分组名 */
const visibleGroupNames = computed(() =>
  groups.value.map((group) => group.name),
);

/** 是否已全部展开 */
const allExpanded = computed(
  () =>
    visibleGroupNames.value.length > 0 &&
    visibleGroupNames.value.every((name) => activeGroups.value.includes(name)),
);

/** 展开当前可见（含过滤后）的全部分组 */
function expandAllGroups() {
  activeGroups.value = [...visibleGroupNames.value];
}

/** 折叠全部分组 */
function collapseAllGroups() {
  activeGroups.value = [];
}

/** 一次性获取全部配置项，后续过滤全部在本地完成 */
async function load() {
  loading.value = true;
  try {
    const list = await listSystemConfigsApi();
    items.value = list ?? [];
    expandAllGroups();
  } finally {
    loading.value = false;
  }
}

// 过滤条件变化时，自动展开命中结果所在的分组
watch(keyword, () => {
  if (keyword.value.trim()) {
    expandAllGroups();
  }
});

/* -------------------------- 编辑配置项 -------------------------- */
const dialogVisible = ref(false);
const saving = ref(false);
const editing = ref<null | SystemConfigApi.ItemInfo>(null);
const editText = ref('');
const editBool = ref(false);
const editArray = ref<string[]>([]);

function openEdit(item: SystemConfigApi.ItemInfo) {
  editing.value = item;
  editText.value = item.value ?? '';
  editBool.value = item.value === 'true';
  editArray.value = item.value
    ? item.value
        .split(',')
        .map((value) => value.trim())
        .filter(Boolean)
    : [];
  dialogVisible.value = true;
}

function buildValue() {
  switch (editing.value?.type) {
    case 'MULTI_SELECT': {
      return editArray.value.join(',');
    }
    case 'SWITCH': {
      return editBool.value ? 'true' : 'false';
    }
    case 'JSON': {
      // JSON 类型会由后端校验并规范化为紧凑 JSON，这里先本地校验一次
      return JSON.stringify(JSON.parse(editText.value));
    }
    default: {
      return editText.value;
    }
  }
}

async function save() {
  if (!editing.value) {
    return;
  }
  saving.value = true;
  try {
    let value: string;
    try {
      value = buildValue();
    } catch {
      ElMessage.error('JSON 格式不正确');
      return;
    }
    await updateSystemConfigApi(editing.value.key, value);
    ElMessage.success('保存成功');
    dialogVisible.value = false;
    await load();
  } finally {
    saving.value = false;
  }
}

/* -------------------------- 其它操作 -------------------------- */
async function restore(item: SystemConfigApi.ItemInfo) {
  try {
    await ElMessageBox.confirm(`确认恢复「${item.name}」的默认值？`, '提示', {
      confirmButtonText: '恢复',
      type: 'warning',
    });
  } catch {
    return;
  }
  await resetSystemConfigApi(item.key);
  ElMessage.success('已恢复默认值');
  await load();
}

async function copyProperties(item: SystemConfigApi.ItemInfo) {
  const text = await getSystemConfigPropertiesApi(item.key);
  try {
    await navigator.clipboard.writeText(text);
    ElMessage.success('配置行已复制到剪贴板');
  } catch {
    ElMessage.warning(`复制失败，配置行：${text}`);
  }
}

async function refreshCache() {
  await refreshSystemConfigApi();
  ElMessage.success('配置缓存已刷新');
  await load();
}

onMounted(load);
</script>

<template>
  <Page
    auto-content-height
    description="对接 /system/configs：列表、按类型编辑、恢复默认、刷新缓存、复制 application.properties 配置行（仅 admin 角色可见）。"
    title="系统配置"
  >
    <template #extra>
      <ElButton :loading="loading" @click="load">重新加载</ElButton>
      <ElButton type="primary" @click="refreshCache">刷新缓存</ElButton>
    </template>

    <div class="flex h-full min-h-0 flex-col gap-3">
      <div class="flex flex-wrap items-center gap-3">
        <ElInput
          v-model="keyword"
          class="max-w-70"
          clearable
          placeholder="按 key、名称、描述或 tag 过滤"
        />
        <span class="text-muted-foreground text-xs">
          共 {{ filteredItems.length }} / {{ items.length }} 项
        </span>
        <div class="ml-auto flex items-center">
          <ElButton
            :disabled="allExpanded"
            link
            type="primary"
            @click="expandAllGroups"
          >
            全部展开
          </ElButton>
          <ElButton
            :disabled="activeGroups.length === 0"
            link
            type="info"
            @click="collapseAllGroups"
          >
            全部折叠
          </ElButton>
        </div>
      </div>

      <div v-loading="loading" class="min-h-0 flex-1 overflow-auto">
        <ElEmpty
          v-if="!loading && groups.length === 0"
          :description="keyword.trim() ? '没有匹配的配置项' : '暂无配置项'"
        />
        <ElCollapse v-else v-model="activeGroups">
          <ElCollapseItem
            v-for="group in groups"
            :key="group.name"
            :name="group.name"
            :title="`${group.name}（${group.items.length}）`"
          >
            <div class="divide-border flex flex-col divide-y">
              <div
                v-for="item in group.items"
                :key="item.key"
                class="flex items-start gap-4 py-3"
              >
                <div class="min-w-0 flex-1">
                  <div class="flex flex-wrap items-center gap-2">
                    <span class="font-medium">{{ item.name }}</span>
                    <ElTag size="small">{{ item.type }}</ElTag>
                    <ElTag v-if="item.isModified" size="small" type="warning">
                      已覆盖
                    </ElTag>
                    <ElTag v-if="item.needRefresh" size="small" type="info">
                      需刷新
                    </ElTag>
                    <ElTag v-if="item.secret" size="small" type="danger">
                      敏感
                    </ElTag>
                  </div>
                  <div class="text-muted-foreground mt-1 text-xs">
                    {{ item.key }} · {{ item.description }}
                  </div>
                  <div class="mt-2 font-mono text-sm break-all">
                    {{ item.formatedValue || item.value || '（空）' }}
                  </div>
                </div>
                <div class="flex shrink-0 items-center">
                  <ElButton link type="primary" @click="openEdit(item)">
                    编辑
                  </ElButton>
                  <ElButton link type="info" @click="copyProperties(item)">
                    复制配置
                  </ElButton>
                  <ElButton
                    :disabled="!item.isModified"
                    link
                    type="danger"
                    @click="restore(item)"
                  >
                    恢复默认
                  </ElButton>
                </div>
              </div>
            </div>
          </ElCollapseItem>
        </ElCollapse>
      </div>
    </div>

    <ElDialog
      v-model="dialogVisible"
      :close-on-click-modal="false"
      :title="`编辑配置：${editing?.name ?? ''}`"
      width="560px"
    >
      <div v-if="editing" class="flex flex-col gap-3">
        <div class="text-muted-foreground font-mono text-xs">
          {{ editing.key }}
        </div>
        <div class="text-muted-foreground text-xs">
          {{ editing.description }}
        </div>

        <ElSwitch v-if="editing.type === 'SWITCH'" v-model="editBool" />
        <ElSelect
          v-else-if="editing.type === 'MULTI_SELECT'"
          v-model="editArray"
          class="w-full"
          multiple
        >
          <ElOption
            v-for="option in editing.provider"
            :key="option.first"
            :label="option.second"
            :value="option.first"
          />
        </ElSelect>
        <ElSelect
          v-else-if="editing.type === 'SELECT'"
          v-model="editText"
          class="w-full"
        >
          <ElOption
            v-for="option in editing.provider"
            :key="option.first"
            :label="option.second"
            :value="option.first"
          />
        </ElSelect>
        <ElInput
          v-else-if="editing.type === 'JSON' || editing.type === 'TEXTAREA'"
          v-model="editText"
          :rows="8"
          type="textarea"
        />
        <ElInput v-else v-model="editText" />

        <div v-if="editing.secret" class="text-xs text-orange-500">
          敏感配置项：值中的 ****** 会回填为原值
        </div>
      </div>
      <template #footer>
        <ElButton @click="dialogVisible = false">取消</ElButton>
        <ElButton :loading="saving" type="primary" @click="save">保存</ElButton>
      </template>
    </ElDialog>
  </Page>
</template>

<script lang="ts" setup>
import type { JsonSchema } from '#/types/openapi';

import { computed, ref, watch } from 'vue';

import {
  ElButton,
  ElInput,
  ElInputNumber,
  ElMessage,
  ElOption,
  ElSelect,
  ElSwitch,
  ElTag,
} from 'element-plus';

defineOptions({ name: 'JsonSchemaEditor' });

const props = withDefaults(
  defineProps<{
    /** 字段路径（点分），用于匹配 secretPaths */
    path?: string;
    /** 字段对应的 JSON Schema；缺省时退化为原始 JSON 编辑 */
    schema?: JsonSchema;
    /** 需要局部脱敏的字段路径，如 a.b.c 或 /a/b/c */
    secretPaths?: string[];
  }>(),
  { path: '', schema: undefined, secretPaths: () => [] },
);

/** 当前节点的值 */
const model = defineModel<unknown>();

/** 当前节点类型：优先取 schema.type，否则按 schema 关键字与值的类型推断 */
const nodeType = computed(() => {
  const schema = props.schema;
  if (schema?.type) {
    return schema.type;
  }
  if (schema?.properties || schema?.additionalProperties) {
    return 'object';
  }
  if (schema?.items) {
    return 'array';
  }
  const value = model.value;
  if (Array.isArray(value)) {
    return 'array';
  }
  if (value !== null && typeof value === 'object') {
    return 'object';
  }
  const valueType = typeof value;
  return ['boolean', 'number', 'string'].includes(valueType)
    ? valueType
    : 'raw';
});

const properties = computed(() =>
  Object.entries(props.schema?.properties ?? {}),
);
const requiredFields = computed<string[]>(() => props.schema?.required ?? []);

/** 下拉可选值（enum 元素类型由后端决定） */
type SelectValue = boolean | number | Record<string, unknown> | string;
const enumOptions = computed<SelectValue[]>(
  () => (props.schema?.enum ?? []) as SelectValue[],
);
const enumValue = computed<SelectValue>(() => model.value as SelectValue);

/** 键值映射对象：无固定 properties、但声明了 additionalProperties */
const isMap = computed(
  () =>
    nodeType.value === 'object' &&
    properties.value.length === 0 &&
    !!props.schema?.additionalProperties,
);

/** 无可用结构信息时，直接用 JSON 源码编辑 */
const useRaw = computed(
  () =>
    nodeType.value === 'raw' ||
    (nodeType.value === 'object' &&
      properties.value.length === 0 &&
      !isMap.value) ||
    (nodeType.value === 'array' && !props.schema?.items),
);

/* ------------------------------ 路径与脱敏 ------------------------------ */

function normalizePath(path: string) {
  return path.replace(/^\/+/, '').split('/').join('.');
}

function joinPath(name: string) {
  return props.path ? `${props.path}.${name}` : name;
}

/** 判断某个字段路径是否在 secretPaths 中 */
function isSecretField(path: string) {
  const target = normalizePath(path);
  return (
    target.length > 0 &&
    props.secretPaths.some((item) => normalizePath(item) === target)
  );
}

const sensitive = computed(() => isSecretField(props.path));

/* ------------------------------ 值读写 ------------------------------ */

function setValue(value: unknown) {
  model.value = value;
}

const stringValue = computed(() => {
  const value = model.value;
  return value === null || value === undefined ? '' : String(value);
});

const booleanValue = computed(() => model.value === true);

const numberValue = computed<number | undefined>(() =>
  typeof model.value === 'number' ? model.value : undefined,
);

const numberStep = computed(
  () => props.schema?.multipleOf ?? (nodeType.value === 'integer' ? 1 : 0.01),
);

const numberPrecision = computed(() =>
  nodeType.value === 'integer' ? 0 : undefined,
);

/** 已整体脱敏的字段值，提示用户提交时会回填原值 */
const masked = computed(
  () => sensitive.value && stringValue.value === '******',
);

/* ------------------------------ 对象 ------------------------------ */

const objectValue = computed<Record<string, unknown>>(() => {
  const value = model.value;
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
});

function childValue(name: string): unknown {
  return objectValue.value[name];
}

function updateChild(name: string, value: unknown) {
  model.value = { ...objectValue.value, [name]: value };
}

/** 键值映射（additionalProperties）的条目 */
const mapEntries = computed(() => Object.entries(objectValue.value));

/** 重命名失败时递增，用于重置输入框显示 */
const keyRevision = ref(0);

function renameEntry(oldKey: string, newKey: string) {
  const key = newKey.trim();
  if (!key || key === oldKey) {
    keyRevision.value += 1;
    return;
  }
  if (key in objectValue.value) {
    ElMessage.warning(`key「${key}」已存在`);
    keyRevision.value += 1;
    return;
  }
  const next: Record<string, unknown> = {};
  for (const [entryKey, entryValue] of Object.entries(objectValue.value)) {
    next[entryKey === oldKey ? key : entryKey] = entryValue;
  }
  model.value = next;
}

function removeEntry(key: string) {
  const next: Record<string, unknown> = {};
  for (const [entryKey, entryValue] of Object.entries(objectValue.value)) {
    if (entryKey !== key) {
      next[entryKey] = entryValue;
    }
  }
  model.value = next;
}

function addEntry() {
  const next = { ...objectValue.value };
  let index = 1;
  while (`key${index}` in next) {
    index += 1;
  }
  next[`key${index}`] = createDefault(props.schema?.additionalProperties);
  model.value = next;
}

/* ------------------------------ 数组 ------------------------------ */

const listValue = computed<unknown[]>(() =>
  Array.isArray(model.value) ? model.value : [],
);

/** 数组元素是否为简单类型（决定是否加边框分组展示） */
const primitiveItem = computed(() =>
  ['boolean', 'integer', 'number', 'string'].includes(
    props.schema?.items?.type ?? '',
  ),
);

function updateItem(index: number, value: unknown) {
  const next = [...listValue.value];
  next[index] = value;
  model.value = next;
}

function addItem() {
  model.value = [...listValue.value, createDefault(props.schema?.items)];
}

function removeItem(index: number) {
  const next = [...listValue.value];
  next.splice(index, 1);
  model.value = next;
}

/** 新增数组项时的默认值 */
function createDefault(schema?: JsonSchema): unknown {
  if (schema?.default !== undefined) {
    return cloneValue(schema.default);
  }
  if (schema?.enum && schema.enum.length > 0) {
    return cloneValue(schema.enum[0]);
  }
  switch (schema?.type) {
    case 'array': {
      return [];
    }
    case 'boolean': {
      return false;
    }
    case 'integer':
    case 'number': {
      return schema.minimum ?? 0;
    }
    case 'object': {
      return {};
    }
    default: {
      return '';
    }
  }
}

function cloneValue(value: unknown) {
  try {
    return structuredClone(value);
  } catch {
    return value;
  }
}

/* ------------------------------ 源码模式 ------------------------------ */

const rawText = ref('');
const rawError = ref('');

function stringify(value: unknown) {
  try {
    return JSON.stringify(value ?? null, null, 2);
  } catch {
    return '';
  }
}

watch(
  [() => model.value, useRaw],
  () => {
    if (useRaw.value) {
      rawText.value = stringify(model.value);
    }
  },
  { deep: true, immediate: true },
);

function commitRaw() {
  try {
    model.value = JSON.parse(rawText.value || 'null');
    rawError.value = '';
  } catch {
    rawError.value = 'JSON 格式不正确';
  }
}
</script>

<template>
  <!-- 无结构信息：直接编辑 JSON 源码 -->
  <div v-if="useRaw" class="flex flex-col gap-1">
    <ElInput
      v-model="rawText"
      :placeholder="schema?.description ?? '请输入 JSON'"
      :rows="4"
      type="textarea"
      @change="commitRaw"
    />
    <span v-if="rawError" class="text-xs text-red-500">{{ rawError }}</span>
  </div>

  <!-- 键值映射：additionalProperties -->
  <div v-else-if="isMap" class="flex flex-col gap-2">
    <div
      v-for="[key, value] in mapEntries"
      :key="`${key}-${keyRevision}`"
      class="flex flex-col gap-2 rounded border border-border p-2"
    >
      <div class="flex items-center gap-2">
        <ElInput
          class="max-w-50"
          :model-value="key"
          placeholder="key"
          @change="(newKey) => renameEntry(key, String(newKey))"
        />
        <ElTag v-if="isSecretField(joinPath(key))" size="small" type="danger">
          敏感
        </ElTag>
        <ElButton class="ml-auto" link type="danger" @click="removeEntry(key)">
          删除
        </ElButton>
      </div>
      <JsonSchemaEditor
        :model-value="value"
        :path="joinPath(key)"
        :schema="schema?.additionalProperties"
        :secret-paths="secretPaths"
        @update:model-value="(next) => updateChild(key, next)"
      />
    </div>
    <div>
      <ElButton link type="primary" @click="addEntry">添加一项</ElButton>
    </div>
    <span class="text-muted-foreground text-xs">
      键值映射：key 可自定义{{
        schema?.additionalProperties?.title
          ? `，值结构为 ${schema.additionalProperties.title}`
          : ''
      }}
    </span>
  </div>

  <!-- 对象：按 properties 渲染字段 -->
  <div v-else-if="nodeType === 'object'" class="flex flex-col gap-3">
    <div
      v-for="[name, property] in properties"
      :key="name"
      class="flex flex-col gap-1"
    >
      <div class="flex flex-wrap items-center gap-1.5 text-xs">
        <span class="text-foreground">{{ property.title ?? name }}</span>
        <span v-if="requiredFields.includes(name)" class="text-red-500">*</span>
        <span class="text-muted-foreground font-mono">{{ name }}</span>
        <ElTag v-if="isSecretField(joinPath(name))" size="small" type="danger">
          敏感
        </ElTag>
        <span v-if="property.type" class="text-muted-foreground">
          · {{ property.type }}
        </span>
      </div>
      <div v-if="property.description" class="text-muted-foreground text-xs">
        {{ property.description }}
      </div>
      <JsonSchemaEditor
        :model-value="childValue(name)"
        :path="joinPath(name)"
        :schema="property"
        :secret-paths="secretPaths"
        @update:model-value="(value) => updateChild(name, value)"
      />
    </div>
  </div>

  <!-- 数组：按 items 渲染，支持增删 -->
  <div v-else-if="nodeType === 'array'" class="flex flex-col gap-2">
    <div
      v-for="(item, index) in listValue"
      :key="index"
      class="flex items-start gap-2"
    >
      <div
        class="min-w-0 flex-1"
        :class="{ 'rounded border border-border p-2': !primitiveItem }"
      >
        <JsonSchemaEditor
          :model-value="item"
          :path="`${path}[${index}]`"
          :schema="schema?.items"
          :secret-paths="secretPaths"
          @update:model-value="(value) => updateItem(index, value)"
        />
      </div>
      <ElButton link type="danger" @click="removeItem(index)">删除</ElButton>
    </div>
    <div>
      <ElButton link type="primary" @click="addItem">添加一项</ElButton>
    </div>
  </div>

  <!-- 枚举 -->
  <ElSelect
    v-else-if="enumOptions.length > 0"
    class="w-full"
    :model-value="enumValue"
    @update:model-value="setValue"
  >
    <ElOption
      v-for="(option, index) in enumOptions"
      :key="index"
      :label="String(option)"
      :value="option"
    />
  </ElSelect>

  <!-- 布尔 -->
  <ElSwitch
    v-else-if="nodeType === 'boolean'"
    :model-value="booleanValue"
    @update:model-value="setValue"
  />

  <!-- 数值 -->
  <div
    v-else-if="nodeType === 'number' || nodeType === 'integer'"
    class="flex flex-col gap-1"
  >
    <ElInputNumber
      class="w-full"
      :max="schema?.maximum"
      :min="schema?.minimum"
      :model-value="numberValue"
      :precision="numberPrecision"
      :step="numberStep"
      @update:model-value="setValue"
    />
    <span class="text-muted-foreground text-xs">
      <template v-if="schema?.minimum !== undefined">
        最小值 {{ schema.minimum }}
      </template>
      <template v-if="schema?.maximum !== undefined">
        ，最大值 {{ schema.maximum }}
      </template>
    </span>
  </div>

  <!-- 字符串及其它 -->
  <div v-else class="flex flex-col gap-1">
    <ElInput
      :maxlength="schema?.maxLength"
      :model-value="stringValue"
      :placeholder="schema?.description ?? schema?.format ?? ''"
      :show-password="sensitive"
      :type="sensitive ? 'password' : 'text'"
      @update:model-value="setValue"
    />
    <span v-if="masked" class="text-xs text-orange-500">
      该字段已脱敏，保留 ****** 提交时后端会回填原值
    </span>
  </div>
</template>

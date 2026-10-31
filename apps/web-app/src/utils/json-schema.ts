import type { FormValues } from '@vben/common-ui';

import type { VbenFormSchema } from '#/adapter/form';
import type { JsonSchema } from '#/types/openapi';

import { z } from '#/adapter/form';

/** 字段级补充配置：与自动生成的 schema 浅合并，componentProps 深合并 */
export interface FieldOverride {
  component?: VbenFormSchema['component'];
  componentProps?: Record<string, unknown>;
  defaultValue?: unknown;
  help?: string;
  label?: string;
  rules?: unknown;
}

interface ConvertOptions {
  /** 字段名 -> 补充配置，如角色下拉的 options、密码框属性 */
  fields?: Record<string, FieldOverride>;
  /** 字段名 -> 中文标签，未命中时使用 schema 的 title 或字段名 */
  labels?: Record<string, string>;
  /** 不参与表单渲染的字段，由页面自行处理（如角色权限树） */
  skip?: string[];
}

/**
 * 把后端返回的 JSON Schema（如 GET /users/form-schema）转换为 vben 表单 schema
 * 只处理文档中出现的常用关键字：type、enum、required、pattern、minimum、maximum、
 * minLength、maxLength、default
 */
export function jsonSchemaToFormSchema<TValues extends FormValues = FormValues>(
  schema: JsonSchema,
  options: ConvertOptions = {},
): VbenFormSchema<TValues>[] {
  const requiredFields = new Set(schema.required);
  const skipFields = new Set(options.skip);

  return Object.entries(schema.properties ?? {})
    .filter(([fieldName]) => !skipFields.has(fieldName))
    .map(([fieldName, property]) => {
      const base = buildFieldSchema(
        fieldName,
        property,
        requiredFields.has(fieldName),
        options.labels,
      ) as Record<string, unknown>;
      const override = options.fields?.[fieldName];
      if (!override) {
        return base as unknown as VbenFormSchema<TValues>;
      }
      return {
        ...base,
        ...override,
        componentProps: {
          ...(base.componentProps as Record<string, unknown>),
          ...override.componentProps,
        },
      } as unknown as VbenFormSchema<TValues>;
    });
}

/** 按字段类型生成表单项 */
function buildFieldSchema(
  fieldName: string,
  property: JsonSchema,
  required: boolean,
  labels?: Record<string, string>,
) {
  const common: Record<string, unknown> = {
    fieldName,
    help: property.description,
    label: labels?.[fieldName] ?? property.title ?? fieldName,
    rules: buildRule(property, required),
  };
  if (property.default !== undefined) {
    common.defaultValue = property.default;
  }

  // 枚举字段使用下拉
  if (property.enum && property.enum.length > 0) {
    return {
      ...common,
      component: 'Select',
      componentProps: {
        class: 'w-full',
        options: toOptions(property.enum),
      },
    };
  }

  // 数组字段（如 roleIds）使用多选，选项由调用方通过 options.fields 注入
  if (property.type === 'array') {
    return {
      ...common,
      component: 'Select',
      componentProps: {
        class: 'w-full',
        multiple: true,
        options: toOptions(property.items?.enum ?? []),
      },
    };
  }

  if (property.type === 'boolean') {
    return { ...common, component: 'Switch' };
  }

  if (property.type === 'number' || property.type === 'integer') {
    return {
      ...common,
      component: 'InputNumber',
      componentProps: {
        class: 'w-full',
        max: property.maximum,
        min: property.minimum,
        step: property.type === 'integer' ? 1 : 0.01,
      },
    };
  }

  // 密码字段使用带显隐开关的密码框
  if (property.format === 'password') {
    return {
      ...common,
      component: 'Input',
      componentProps: {
        autocomplete: 'new-password',
        class: 'w-full',
        maxlength: property.maxLength,
        showPassword: true,
        type: 'password',
      },
    };
  }

  return {
    ...common,
    component: 'Input',
    componentProps: {
      class: 'w-full',
      maxlength: property.maxLength,
      placeholder: property.description ?? '',
    },
  };
}

/** 枚举值转换为下拉选项 */
function toOptions(values: unknown[]) {
  return values.map((value) => ({ label: String(value), value }));
}

/**
 * 生成 zod 规则；required 只表示字段必须提交，
 * 数组字段（如 roleIds）允许空数组，表示清空关联
 */
function buildRule(property: JsonSchema, required: boolean) {
  const rule = buildBaseRule(property, required);
  return required ? rule : rule.optional();
}

function buildBaseRule(property: JsonSchema, required: boolean) {
  if (property.type === 'boolean') {
    return z.boolean();
  }

  if (property.type === 'array') {
    const itemType = property.items?.type;
    const element =
      itemType === 'number' || itemType === 'integer' ? z.number() : z.string();
    return z.array(element);
  }

  if (property.type === 'number' || property.type === 'integer') {
    let rule = z.number();
    if (property.minimum !== undefined) {
      rule = rule.min(property.minimum, {
        message: `不能小于 ${property.minimum}`,
      });
    }
    if (property.maximum !== undefined) {
      rule = rule.max(property.maximum, {
        message: `不能大于 ${property.maximum}`,
      });
    }
    return rule;
  }

  let rule = z.string();
  if (property.minLength !== undefined && property.minLength > 0) {
    rule = rule.min(property.minLength, {
      message: `至少 ${property.minLength} 个字符`,
    });
  } else if (required) {
    rule = rule.min(1, { message: '不能为空' });
  }
  if (property.maxLength !== undefined) {
    rule = rule.max(property.maxLength, {
      message: `最多 ${property.maxLength} 个字符`,
    });
  }
  const pattern = toRegExp(property.pattern);
  if (pattern) {
    rule = rule.regex(pattern, { message: '格式不正确' });
  }
  return rule;
}

/** 后端 pattern 可能不兼容 JS，非法时忽略该约束 */
function toRegExp(pattern?: string) {
  if (!pattern) {
    return null;
  }
  try {
    return new RegExp(pattern);
  } catch {
    return null;
  }
}

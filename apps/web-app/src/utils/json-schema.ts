import type { VbenFormSchema } from '#/adapter/form';
import type { JsonSchema } from '#/types/openapi';

import { z } from '#/adapter/form';

interface ConvertOptions {
  /** 字段名 -> 中文标签，未命中时使用 schema 的 title 或字段名 */
  labels?: Record<string, string>;
}

/**
 * 把后端返回的 JSON Schema（GET /books/form-schema）转换为 vben 表单 schema
 * 只处理文档中出现的常用关键字：type、enum、required、minimum、maximum、maxLength
 */
export function jsonSchemaToFormSchema(
  schema: JsonSchema,
  options: ConvertOptions = {},
): VbenFormSchema[] {
  const requiredFields = new Set<string>(schema.required);

  return Object.entries(schema.properties ?? {}).map(
    ([fieldName, property]) => {
      const common = {
        fieldName,
        help: property.description,
        label: options.labels?.[fieldName] ?? property.title ?? fieldName,
        rules: buildRule(property, requiredFields.has(fieldName)),
      };

      // 枚举字段使用下拉
      if (property.enum && property.enum.length > 0) {
        return {
          ...common,
          component: 'Select',
          componentProps: {
            class: 'w-full',
            options: property.enum.map((value) => ({
              label: String(value),
              value,
            })),
          },
        } as VbenFormSchema;
      }

      if (property.type === 'boolean') {
        return { ...common, component: 'Switch' } as VbenFormSchema;
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
        } as VbenFormSchema;
      }

      return {
        ...common,
        component: 'Input',
        componentProps: {
          class: 'w-full',
          maxlength: property.maxLength,
          placeholder: property.description ?? '',
        },
      } as VbenFormSchema;
    },
  );
}

function buildRule(property: JsonSchema, required: boolean) {
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
    return required ? rule : rule.optional();
  }

  let rule = z.string();
  if (required) {
    rule = rule.min(1, { message: '不能为空' });
  }
  if (property.maxLength !== undefined) {
    rule = rule.max(property.maxLength, {
      message: `最多 ${property.maxLength} 个字符`,
    });
  }
  return required ? rule : rule.optional();
}

import type { PermissionApi } from '#/api';

/** 权限树节点，children 由权限编码的 `:` 分层自动构建 */
export interface PermissionTreeNode extends PermissionApi.Permission {
  children?: PermissionTreeNode[];
}

/**
 * 是否为分组节点（编码不含 `:`，如 `book`）。
 * 分组节点只用于整组勾选或菜单组展示，本身不对应后端鉴权。
 */
export function isPermissionGroup(code: string): boolean {
  return !code.includes(':');
}

/**
 * 按权限编码的 `:` 分层构建权限树。
 * - 保持接口返回的顺序（按编码排序）
 * - 中间层缺失时挂到最近的已存在祖先下，仍然缺失则作为根节点
 */
export function buildPermissionTree(
  permissions: PermissionApi.Permission[],
): PermissionTreeNode[] {
  const nodes = new Map<string, PermissionTreeNode>();
  const codes: string[] = [];

  for (const item of permissions ?? []) {
    const code = item?.code?.trim();
    if (!code || nodes.has(code)) {
      continue;
    }
    nodes.set(code, { ...item, code });
    codes.push(code);
  }

  const roots: PermissionTreeNode[] = [];
  for (const code of codes) {
    const node = nodes.get(code);
    if (!node) {
      continue;
    }
    const segments = code.split(':');
    let parent: PermissionTreeNode | undefined;
    // 从最近的前缀开始向上查找已存在的祖先节点
    for (let index = segments.length - 1; index > 0; index -= 1) {
      const candidate = nodes.get(segments.slice(0, index).join(':'));
      if (candidate) {
        parent = candidate;
        break;
      }
    }
    if (parent) {
      parent.children ??= [];
      parent.children.push(node);
    } else {
      roots.push(node);
    }
  }

  return roots;
}

/**
 * 后端权限匹配方式为 simple（`jmicro.auth.permission-match=simple`），
 * 权限点没有通配符，前后端一一对应，这里只做去重与空白清理。
 */
export function normalizePermissionCodes(permissions: string[]): string[] {
  const codes = new Set<string>();

  for (const permission of permissions) {
    const code = permission?.trim();
    if (code) {
      codes.add(code);
    }
  }

  return [...codes];
}

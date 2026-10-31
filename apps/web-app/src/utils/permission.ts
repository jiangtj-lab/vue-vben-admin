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

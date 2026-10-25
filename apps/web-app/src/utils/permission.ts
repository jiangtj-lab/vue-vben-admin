/**
 * 前端页面中实际使用到的权限码。
 * 后端权限匹配为 ant-style，`book:*` 可覆盖 `book:read`、`book:write`，
 * 这里在登录后把通配权限展开成具体权限码，供 v-access:code 使用。
 */
const KNOWN_PERMISSION_CODES = ['book:read', 'book:write'];

export function expandPermissionCodes(permissions: string[]): string[] {
  const codes = new Set(permissions);

  for (const permission of permissions) {
    if (!permission.endsWith(':*')) {
      continue;
    }
    const prefix = permission.slice(0, -1);
    for (const code of KNOWN_PERMISSION_CODES) {
      if (code.startsWith(prefix)) {
        codes.add(code);
      }
    }
  }

  return [...codes];
}

const SYSTEM_NAME = "v3-admin-vite"

/** 认证缓存沿用原 Token 键，不引入其他功能的持久化状态。 */
export class CacheKey {
  static readonly TOKEN = `${SYSTEM_NAME}-token-key`
}

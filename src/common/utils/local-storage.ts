import { CacheKey } from "@@/constants/cache-key"

export function getToken() {
  return localStorage.getItem(CacheKey.TOKEN)
}

export function setToken(token: string) {
  localStorage.setItem(CacheKey.TOKEN, token)
}

export function removeToken() {
  localStorage.removeItem(CacheKey.TOKEN)
}

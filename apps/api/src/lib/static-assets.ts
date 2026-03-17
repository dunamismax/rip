import { isAbsolute, relative, resolve } from 'node:path'

export function resolveStaticAssetPath(root: string, requestPath: string) {
  const normalizedPath = requestPath === '/' ? '/index.html' : requestPath
  const absolutePath = resolve(root, `.${normalizedPath}`)
  const relativePath = relative(root, absolutePath)

  if (
    relativePath.startsWith('..') ||
    isAbsolute(relativePath) ||
    relativePath.includes('\0')
  ) {
    return null
  }

  return absolutePath
}

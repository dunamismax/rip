import { describe, expect, it } from 'vitest'
import { resolveStaticAssetPath } from './static-assets'

describe('resolveStaticAssetPath', () => {
  const root = '/tmp/rip-web-dist'

  it('maps the root request to the SPA entrypoint', () => {
    expect(resolveStaticAssetPath(root, '/')).toBe(
      '/tmp/rip-web-dist/index.html'
    )
  })

  it('rejects traversal paths that escape the dist directory', () => {
    expect(
      resolveStaticAssetPath(root, '/../rip-web-dist-evil/index.html')
    ).toBeNull()
  })
})

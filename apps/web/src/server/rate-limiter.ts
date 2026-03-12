export class RateLimiter {
  private readonly entries = new Map<string, number[]>()

  constructor(
    private readonly limit: number,
    private readonly windowMs: number
  ) {}

  allow(key: string) {
    const now = Date.now()
    const cutoff = now - this.windowMs
    const current = (this.entries.get(key) ?? []).filter(
      (value) => value > cutoff
    )

    if (current.length >= this.limit) {
      this.entries.set(key, current)
      return false
    }

    current.push(now)
    this.entries.set(key, current)
    return true
  }
}

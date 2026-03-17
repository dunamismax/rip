export class AppError extends Error {
  constructor(
    readonly status: number,
    message: string,
    readonly cause?: unknown
  ) {
    super(message)
    this.name = 'AppError'
  }
}

export function toAppError(
  error: unknown,
  fallbackMessage = 'Unexpected server error.'
) {
  if (error instanceof AppError) {
    return error
  }

  return new AppError(500, fallbackMessage, error)
}

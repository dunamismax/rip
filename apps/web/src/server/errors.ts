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
): AppError {
  if (error instanceof AppError) {
    return error
  }

  if (error instanceof Error) {
    return new AppError(500, error.message || fallbackMessage, error)
  }

  return new AppError(500, fallbackMessage, error)
}

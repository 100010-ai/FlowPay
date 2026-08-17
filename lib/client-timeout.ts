export class ClientTimeoutError extends Error {
  constructor(message = 'REQUEST_TIMEOUT') {
    super(message)
    this.name = 'ClientTimeoutError'
  }
}

export async function withClientTimeout<T>(promise: PromiseLike<T>, timeoutMs = 10_000, message = 'REQUEST_TIMEOUT'): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined
  try {
    return await Promise.race([
      Promise.resolve(promise),
      new Promise<T>((_, reject) => {
        timer = setTimeout(() => reject(new ClientTimeoutError(message)), timeoutMs)
      }),
    ])
  } finally {
    if (timer) clearTimeout(timer)
  }
}

export async function fetchWithClientTimeout(input: RequestInfo | URL, init: RequestInit = {}, timeoutMs = 10_000) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    return await fetch(input, { ...init, signal: controller.signal })
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') throw new ClientTimeoutError()
    throw error
  } finally {
    clearTimeout(timer)
  }
}

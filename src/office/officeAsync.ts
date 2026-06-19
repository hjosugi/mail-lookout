/// <reference types="office-js" />

/**
 * A small bridge from Office callbacks to promises.
 *
 * The Office API uses a callback with an AsyncResult. We wrap it
 * once here so the rest of the Office layer can use async/await
 * and try/catch.
 */

/**
 * An Office async failure, carrying the original Office.Error detail.
 *
 * Office reports failures through `AsyncResult.error` with a numeric
 * `code` and a `name`. A plain Error drops those, so we keep them so
 * failures stay debuggable.
 */
class OfficeAsyncError extends Error {
  readonly code: number | undefined
  /** The Office-supplied error name, kept off `name` so the stack reads cleanly. */
  readonly officeName: string | undefined

  constructor(error: Office.Error | undefined) {
    super(error?.message ?? "Office async call failed")
    this.name = "OfficeAsyncError"
    this.code = error?.code
    this.officeName = error?.name
  }
}

/**
 * Run an Office async call and return a promise.
 *
 * The call resolves with the result value on success and rejects with
 * an OfficeAsyncError on failure, keeping the Office error detail. A
 * synchronous throw from the call itself also rejects, so callers only
 * ever need try/catch.
 */
export function promisify<T>(
  call: (callback: (result: Office.AsyncResult<T>) => void) => void,
): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    try {
      call(result => {
        if (result.status === Office.AsyncResultStatus.Succeeded) {
          resolve(result.value)
        } else {
          reject(new OfficeAsyncError(result.error))
        }
      })
    } catch (error) {
      reject(error)
    }
  })
}

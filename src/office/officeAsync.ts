/// <reference types="office-js" />

/**
 * A small bridge from Office callbacks to promises.
 *
 * The Office API uses a callback with an AsyncResult. We wrap it
 * once here so the rest of the Office layer can use async/await
 * and try/catch.
 */

/**
 * Run an Office async call and return a promise.
 *
 * The call resolves on success and rejects with an Error on
 * failure. Pass a function that takes the Office callback.
 */
export function promisify<T>(
  call: (callback: (result: Office.AsyncResult<T>) => void) => void,
): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    call((result) => {
      if (result.status === Office.AsyncResultStatus.Succeeded) {
        resolve(result.value);
      } else {
        reject(new Error(result.error?.message ?? "Office async call failed"));
      }
    });
  });
}

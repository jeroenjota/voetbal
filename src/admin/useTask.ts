import { ref } from 'vue'
import { errorMessage } from '../api'

/** Busy/error/success state for an admin tab. */
export function useTask() {
  const busy = ref(false)
  const error = ref('')
  const message = ref('')
  let timer: number | undefined

  async function run<T>(action: () => Promise<T>, success = ''): Promise<T | undefined> {
    busy.value = true
    error.value = ''
    message.value = ''
    window.clearTimeout(timer)
    try {
      const result = await action()
      message.value = success
      if (success) timer = window.setTimeout(() => { message.value = '' }, 4000)
      return result
    } catch (cause) {
      error.value = errorMessage(cause)
      return undefined
    } finally {
      busy.value = false
    }
  }

  return { busy, error, message, run }
}

export const emptyToNull = (value: string | null | undefined) => (value?.trim() ? value.trim() : null)

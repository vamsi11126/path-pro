export async function readTextStream(stream, onChunk) {
  if (!stream) {
    return ''
  }

  const reader = stream.getReader()
  let output = ''

  try {
    while (true) {
      const { done, value } = await reader.read()

      if (done) {
        break
      }

      const chunk = typeof value === 'string' ? value : new TextDecoder().decode(value)
      output += chunk

      if (onChunk) {
        onChunk(chunk)
      }
    }
  } finally {
    reader.releaseLock()
  }

  return output
}

export function formatExecutionError(error) {
  if (error?.name === 'AbortError') {
    return 'Execution was cancelled.'
  }

  if (error instanceof Error) {
    return error.message
  }

  if (typeof error === 'string') {
    return error
  }

  return 'Execution failed.'
}

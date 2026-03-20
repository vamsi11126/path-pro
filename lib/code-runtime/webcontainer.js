import { readTextStream } from '@/lib/code-runtime/shared'

let webcontainerPromise = null

function ensureBrowser() {
  if (typeof window === 'undefined') {
    throw new Error('Code execution is only available in the browser.')
  }
}

async function bootWebContainer() {
  const { WebContainer } = await import('@webcontainer/api')

  return WebContainer.boot({
    coep: 'credentialless',
    workdirName: 'path-pro-playground',
  })
}

export async function getWebContainer() {
  ensureBrowser()

  if (!window.crossOriginIsolated) {
    throw new Error('JavaScript execution needs a cross-origin isolated page. Reload the lesson after the new headers are active, or use a Chromium-based browser over localhost/HTTPS.')
  }

  if (!webcontainerPromise) {
    webcontainerPromise = bootWebContainer().catch((error) => {
      webcontainerPromise = null
      throw error
    })
  }

  return webcontainerPromise
}

function createJavaScriptRunnerSource(code) {
  return `import { createRequire } from 'module'
const require = createRequire(import.meta.url)

${code}
`
}

export async function runJavaScriptInWebContainer(code, options = {}) {
  const { onOutput, signal } = options
  const webcontainer = await getWebContainer()

  if (signal?.aborted) {
    throw new DOMException('Execution cancelled', 'AbortError')
  }

  const fileName = 'snippet.mjs'

  await webcontainer.fs.writeFile(fileName, createJavaScriptRunnerSource(code))

  const process = await webcontainer.spawn('node', [fileName])
  const abortExecution = () => process.kill()

  signal?.addEventListener('abort', abortExecution, { once: true })

  try {
    const [output, exitCode] = await Promise.all([
      readTextStream(process.output, onOutput),
      process.exit,
    ])

    return {
      exitCode,
      output,
      success: exitCode === 0,
    }
  } finally {
    signal?.removeEventListener('abort', abortExecution)
  }
}

let pyodidePromise = null

const PYODIDE_BASE_PATH = '/pyodide/'

const PYTHON_RUNNER = `
import contextlib
import inspect
import io
import traceback

_path_pro_stdout = io.StringIO()
_path_pro_stderr = io.StringIO()
_path_pro_scope = {"__name__": "__main__"}
_path_pro_success = True

with contextlib.redirect_stdout(_path_pro_stdout), contextlib.redirect_stderr(_path_pro_stderr):
    try:
        exec(compile(__path_pro_source, "<snippet>", "exec"), _path_pro_scope)
        _path_pro_main = _path_pro_scope.get("main")
        if callable(_path_pro_main):
            _path_pro_main_result = _path_pro_main()
            if inspect.isawaitable(_path_pro_main_result):
                await _path_pro_main_result
    except Exception:
        _path_pro_success = False
        traceback.print_exc(file=_path_pro_stderr)

__path_pro_result = {
    "stdout": _path_pro_stdout.getvalue(),
    "stderr": _path_pro_stderr.getvalue(),
    "success": _path_pro_success,
}
`

function ensureBrowser() {
  if (typeof window === 'undefined') {
    throw new Error('Code execution is only available in the browser.')
  }
}

async function loadPyodideRuntime() {
  const pyodideModuleUrl = `${PYODIDE_BASE_PATH}pyodide.mjs`
  const { loadPyodide } = await import(/* webpackIgnore: true */ pyodideModuleUrl)

  return loadPyodide({
    fullStdLib: false,
    indexURL: PYODIDE_BASE_PATH,
    lockFileURL: `${PYODIDE_BASE_PATH}pyodide-lock.json`,
    packageBaseUrl: PYODIDE_BASE_PATH,
    stdLibURL: `${PYODIDE_BASE_PATH}python_stdlib.zip`,
  })
}

export async function getPyodide() {
  ensureBrowser()

  if (!pyodidePromise) {
    pyodidePromise = loadPyodideRuntime().catch((error) => {
      pyodidePromise = null
      throw error
    })
  }

  return pyodidePromise
}

function normalizePythonOutput(stdout = '', stderr = '') {
  return [stdout, stderr].filter(Boolean).join(stdout && stderr ? '\n' : '')
}

export async function runPythonInPyodide(code, options = {}) {
  const { onOutput } = options
  const pyodide = await getPyodide()

  await pyodide.loadPackagesFromImports(code)
  pyodide.globals.set('__path_pro_source', code)

  try {
    await pyodide.runPythonAsync(PYTHON_RUNNER)
    const resultProxy = pyodide.globals.get('__path_pro_result')
    const result = resultProxy.toJs({ dict_converter: Object.fromEntries })
    resultProxy.destroy()

    const output = normalizePythonOutput(result.stdout, result.stderr)

    if (output && onOutput) {
      onOutput(output)
    }

    return {
      exitCode: result.success ? 0 : 1,
      output,
      success: Boolean(result.success),
    }
  } finally {
    pyodide.globals.delete('__path_pro_result')
    pyodide.globals.delete('__path_pro_source')
  }
}

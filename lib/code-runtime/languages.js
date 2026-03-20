const LANGUAGE_ALIASES = {
  cjs: 'javascript',
  javascript: 'javascript',
  js: 'javascript',
  jsx: 'javascript',
  mjs: 'javascript',
  node: 'javascript',
  nodejs: 'javascript',
  py: 'python',
  py3: 'python',
  python: 'python',
}

const LANGUAGE_LABELS = {
  javascript: 'JavaScript',
  python: 'Python',
}

const RUNTIME_LABELS = {
  javascript: 'WebContainers',
  python: 'Pyodide',
}

export function normalizeRunnableLanguage(language) {
  if (!language) {
    return null
  }

  return LANGUAGE_ALIASES[String(language).trim().toLowerCase()] || null
}

export function isRunnableLanguage(language) {
  return Boolean(normalizeRunnableLanguage(language))
}

export function getRunnableLanguageLabel(language) {
  const normalizedLanguage = normalizeRunnableLanguage(language)
  return normalizedLanguage ? LANGUAGE_LABELS[normalizedLanguage] : null
}

export function getRuntimeLabel(language) {
  const normalizedLanguage = normalizeRunnableLanguage(language)
  return normalizedLanguage ? RUNTIME_LABELS[normalizedLanguage] : null
}

function normalizeText(value) {
  return String(value || '').trim()
}

function toPascalCase(value, fallback = 'Topic') {
  const tokens = normalizeText(value)
    .replace(/[^a-zA-Z0-9]+/g, ' ')
    .split(/\s+/)
    .filter(Boolean)

  if (tokens.length === 0) {
    return fallback
  }

  return tokens
    .map((token) => token.charAt(0).toUpperCase() + token.slice(1))
    .join('')
}

const LANGUAGE_RULES = [
  {
    id: 'typescript',
    displayName: 'TypeScript',
    aliases: ['typescript', 'ts'],
    pattern: /\b(typescript|type script|\bts\b)\b/i
  },
  {
    id: 'javascript',
    displayName: 'JavaScript',
    aliases: ['javascript', 'js', 'node', 'react', 'next.js', 'nextjs'],
    pattern: /\b(javascript|java script|\bjs\b|node|react|next\.?js)\b/i
  },
  {
    id: 'java',
    displayName: 'Java',
    aliases: ['java', 'jdk', 'jvm'],
    pattern: /\b(java|jdk|jvm)\b/i
  },
  {
    id: 'python',
    displayName: 'Python',
    aliases: ['python', 'py'],
    pattern: /\b(python|\bpy\b)\b/i
  },
  {
    id: 'csharp',
    displayName: 'C#',
    aliases: ['c#', 'csharp', '.net', 'dotnet'],
    pattern: /\b(c#|csharp|\.net|dotnet)\b/i
  },
  {
    id: 'cpp',
    displayName: 'C++',
    aliases: ['c++', 'cpp'],
    pattern: /\b(c\+\+|cpp)\b/i
  },
  {
    id: 'sql',
    displayName: 'SQL',
    aliases: ['sql', 'mysql', 'postgres', 'postgresql', 'sqlite'],
    pattern: /\b(sql|mysql|postgres|postgresql|sqlite)\b/i
  },
  {
    id: 'html',
    displayName: 'HTML',
    aliases: ['html'],
    pattern: /\bhtml\b/i
  },
  {
    id: 'css',
    displayName: 'CSS',
    aliases: ['css', 'tailwind'],
    pattern: /\b(css|tailwind)\b/i
  }
]

export function inferCodeLanguage({
  subjectTitle = '',
  subjectDescription = '',
  subjectSyllabus = '',
  topicTitle = '',
  topicDescription = ''
}) {
  const combined = [
    normalizeText(subjectTitle),
    normalizeText(subjectDescription),
    normalizeText(subjectSyllabus),
    normalizeText(topicTitle),
    normalizeText(topicDescription)
  ].join(' ')

  for (const rule of LANGUAGE_RULES) {
    if (rule.pattern.test(combined)) {
      return rule
    }
  }

  return {
    id: 'text',
    displayName: 'domain-native code',
    aliases: ['pseudocode', 'text'],
    pattern: null
  }
}

export function buildCodeExampleGuidance(context = {}) {
  const language = inferCodeLanguage(context)

  return [
    `Inferred code language for this topic: ${language.displayName}.`,
    language.id === 'text'
      ? 'If you include code, use domain-native pseudocode or a language clearly named by the lesson. Do not default to JavaScript.'
      : `If you include code, use ${language.displayName} syntax, markdown fences, identifiers, and terminology. Do not switch to another language.`,
    language.id === 'java'
      ? 'For Java topics, prefer classes, interfaces, implementations, method signatures, and main methods over JavaScript functions.'
      : null,
    language.id === 'sql'
      ? 'For SQL topics, prefer queries, schema snippets, and result reasoning over general-purpose language code.'
      : null
  ].filter(Boolean).join('\n')
}

export function buildFallbackCodeSnippet({ topicTitle, languageId }) {
  const pascalName = toPascalCase(topicTitle, 'Topic')
  const methodName = `prove${pascalName}`
  const safeTopic = normalizeText(topicTitle || 'topic')

  switch (languageId) {
    case 'java':
      return {
        language: 'java',
        starterCode: `class ${pascalName}Proof {\n  static String ${methodName}(String input) {\n    String summary = input == null ? \"\" : input.trim();\n    return summary;\n  }\n\n  public static void main(String[] args) {\n    System.out.println(${methodName}(\"${safeTopic}\"));\n  }\n}`,
        solutionCode: `class ${pascalName}Proof {\n  static String ${methodName}(String input) {\n    return input == null ? \"\" : input.trim();\n  }\n}`,
        expectedOutput: safeTopic
      }
    case 'typescript':
      return {
        language: 'typescript',
        starterCode: `function ${methodName}(input: string | null | undefined): string {\n  const summary = String(input ?? '').trim()\n  return summary\n}\n\nconsole.log(${methodName}('${safeTopic}'))`,
        solutionCode: `function ${methodName}(input: string | null | undefined): string {\n  return String(input ?? '').trim()\n}`,
        expectedOutput: safeTopic
      }
    case 'python':
      return {
        language: 'python',
        starterCode: `def ${methodName}(input_value: str | None) -> str:\n    summary = (input_value or '').strip()\n    return summary\n\nprint(${methodName}('${safeTopic}'))`,
        solutionCode: `def ${methodName}(input_value: str | None) -> str:\n    return (input_value or '').strip()`,
        expectedOutput: safeTopic
      }
    case 'csharp':
      return {
        language: 'csharp',
        starterCode: `using System;\n\nclass ${pascalName}Proof\n{\n    static string ${methodName}(string input)\n    {\n        string summary = (input ?? string.Empty).Trim();\n        return summary;\n    }\n\n    static void Main()\n    {\n        Console.WriteLine(${methodName}(\"${safeTopic}\"));\n    }\n}`,
        solutionCode: `using System;\n\nclass ${pascalName}Proof\n{\n    static string ${methodName}(string input)\n    {\n        return (input ?? string.Empty).Trim();\n    }\n}`,
        expectedOutput: safeTopic
      }
    case 'cpp':
      return {
        language: 'cpp',
        starterCode: `#include <iostream>\n#include <string>\n\nstd::string trimTopic(const std::string& input) {\n    return input;\n}\n\nint main() {\n    std::cout << trimTopic("${safeTopic}") << std::endl;\n    return 0;\n}`,
        solutionCode: `#include <string>\n\nstd::string trimTopic(const std::string& input) {\n    return input;\n}`,
        expectedOutput: safeTopic
      }
    case 'sql':
      return {
        language: 'sql',
        starterCode: `SELECT TRIM('${safeTopic}') AS topic_summary;`,
        solutionCode: `SELECT TRIM('${safeTopic}') AS topic_summary;`,
        expectedOutput: safeTopic
      }
    case 'html':
      return {
        language: 'html',
        starterCode: `<section class="topic-proof">\n  <h1>${safeTopic}</h1>\n  <p>Explain the mechanism and why it matters.</p>\n</section>`,
        solutionCode: `<section class="topic-proof">\n  <h1>${safeTopic}</h1>\n  <p>Explain the mechanism and why it matters.</p>\n</section>`,
        expectedOutput: `<h1>${safeTopic}</h1>`
      }
    case 'css':
      return {
        language: 'css',
        starterCode: `.topic-proof {\n  border-left: 4px solid #2563eb;\n  padding-left: 1rem;\n}`,
        solutionCode: `.topic-proof {\n  border-left: 4px solid #2563eb;\n  padding-left: 1rem;\n}`,
        expectedOutput: 'A styled topic-proof block'
      }
    case 'javascript':
    default:
      return {
        language: 'javascript',
        starterCode: `function ${methodName}(input) {\n  const summary = String(input).trim()\n  return summary\n}\n\nconsole.log(${methodName}('${safeTopic}'))`,
        solutionCode: `function ${methodName}(input) {\n  return String(input).trim()\n}`,
        expectedOutput: safeTopic
      }
  }
}

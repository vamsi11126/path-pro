import { createHash } from 'crypto'

export function buildSourceSignature(input) {
  const json = JSON.stringify(input, Object.keys(input).sort())
  return createHash('sha256').update(json).digest('hex')
}

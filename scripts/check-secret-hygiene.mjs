import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'

const files = execFileSync('git', ['ls-files', '-z'], { encoding: 'utf8' })
  .split('\0')
  .filter(Boolean)
const forbiddenName = /deploy-secrets|_vercel_.*\.json|_deploy_.*\.json/i
const secretValue = /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----|\b(?:sb_secret_|sk_live_|ghp_)[A-Za-z0-9_-]{16,}/
// `.env*` files are forbidden unless they are a committed template, i.e. the
// name ends in `.example` (`.env.example`, `.env.assistant.example`, …).
const envTemplate = /\.env(\.[\w-]+)*\.example$/i
const failures = files.filter((file) => {
  if (
    forbiddenName.test(file) ||
    (/(^|\/)\.env($|\.)/i.test(file) && !envTemplate.test(file))
  ) {
    return true
  }
  try {
    return secretValue.test(readFileSync(file, 'utf8'))
  } catch {
    return false
  }
})

if (failures.length) {
  console.error(`Secret hygiene check failed: ${failures.join(', ')}`)
  process.exit(1)
}

console.log('Secret hygiene check passed')

import { existsSync, readFileSync, writeFileSync } from 'node:fs'

import { resolve } from 'node:path'

const targetUrl = 'http://124.222.187.70:3001'
const envFile = resolve(process.cwd(), '.env.production')
const key = 'VITE_API_BASE_URL'

const current = existsSync(envFile) ? readFileSync(envFile, 'utf8') : ''
const lines = current
  .split(/\r?\n/)
  .filter(line => line.trim() && !line.startsWith(`${key}=`))

lines.push(`${key}=${targetUrl}`)
writeFileSync(envFile, `${lines.join('\n')}\n`)

console.log(`${key}=${targetUrl}`)

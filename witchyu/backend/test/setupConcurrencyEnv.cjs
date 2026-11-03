const path = require('node:path')
const dotenv = require('dotenv')

const envPath = path.resolve(process.cwd(), '.env.test')
const loaded = dotenv.config({ path: envPath, override: true })

if (loaded.error) {
  throw new Error(`Cannot load test environment: ${loaded.error.message}`)
}

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL is missing from .env.test')
}

const host = new URL(process.env.DATABASE_URL).hostname
const allowedHost = 'ep-twilight-dream-b5joxsvo-pooler.c-7.us-east-2.aws.neon.tech'

if (host !== allowedHost) {
  throw new Error(`Unsafe test database host: ${host}`)
}

console.log(`TEST DATABASE SAFETY CHECK PASSED: ${host}`)

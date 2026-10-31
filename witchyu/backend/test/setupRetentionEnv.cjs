const path = require('node:path')
require('dotenv').config({ path: path.resolve(__dirname, '../.env.retention-test') })

const url = process.env.DATABASE_URL
if (!url) throw new Error('RETENTION TEST BLOCKED: DATABASE_URL missing')

const host = new URL(url).hostname
const expected = process.env.RETENTION_TEST_DB_HOST

if (!expected || host !== expected) {
  throw new Error(`RETENTION TEST BLOCKED: unexpected database host: ${host}`)
}

console.log(`RETENTION TEST DATABASE CHECK PASSED: ${host}`)

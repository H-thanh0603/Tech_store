#!/usr/bin/env node
// Print the current TOTP code for the local admin MFA secret (.admin-e2e-mfa-secret).
import { readFileSync } from 'node:fs'
import { createHmac } from 'node:crypto'

const secret = readFileSync(new URL('../.admin-e2e-mfa-secret', import.meta.url), 'utf8').trim()
const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567'
let bits = ''
for (const char of secret.replace(/=+$/u, '').toUpperCase()) {
  bits += alphabet.indexOf(char).toString(2).padStart(5, '0')
}
const key = Buffer.from(bits.match(/.{8}/gu)?.map((byte) => Number.parseInt(byte, 2)) ?? [])
const counter = Buffer.alloc(8)
const epoch = Math.floor(Date.now() / 30_000)
counter.writeBigUInt64BE(BigInt(epoch))
const digest = createHmac('sha1', key).update(counter).digest()
const offset = digest[digest.length - 1] & 0x0f
const value = (digest.readUInt32BE(offset) & 0x7fffffff) % 1_000_000
console.log(`${value.toString().padStart(6, '0')}  (còn ${30 - (Math.floor(Date.now() / 1000) % 30)}s)`)

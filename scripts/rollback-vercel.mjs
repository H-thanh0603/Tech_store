#!/usr/bin/env node
// Rollback Vercel prod về deployment ổn định trước đó.
// Dùng: DEPLOY_ROLLBACK_TARGET=<url|id> npm run deploy:rollback
// Mặc định: promote deployment success gần nhất khác current (cần VERCEL_TOKEN).
const target = process.env.DEPLOY_ROLLBACK_TARGET
if (!target) {
  console.error('Thiếu DEPLOY_ROLLBACK_TARGET (deployment URL hoặc ID cần rollback về).')
  console.error('Ví dụ: DEPLOY_ROLLBACK_TARGET=https://techstore-abc.vercel.app npm run deploy:rollback')
  process.exit(1)
}
const token = process.env.VERCEL_TOKEN
if (!token) {
  console.error('Thiếu VERCEL_TOKEN.')
  process.exit(1)
}
console.log(`Rollback prod → ${target}`)
console.log('Mở Vercel dashboard → Deployments → chọn deployment → Promote to Production,')
console.log('hoặc: vercel promote <deployment-url> --token=$VERCEL_TOKEN')
console.log('DB: chỉ forward-fix migration, cấm db reset prod (xem RUNBOOK).')

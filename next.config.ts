import type { NextConfig } from 'next'

// Pin the workspace root to this project. A stray lockfile higher up the drive
// (D:\pnpm-lock.yaml) otherwise makes Next infer the wrong root and mis-trace files.
const nextConfig: NextConfig = {
  turbopack: {
    root: import.meta.dirname,
  },
}

export default nextConfig

import type { NextConfig } from 'next'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'
import { initOpenNextCloudflareForDev } from '@opennextjs/cloudflare'

const __dirname = dirname(fileURLToPath(import.meta.url))

const config: NextConfig = {
  reactStrictMode: true,
  output: 'standalone',
  outputFileTracingRoot: resolve(__dirname, '../..'),
  images: {
    unoptimized: true
  }
  // www -> apex redirect lives in middleware.ts. We tried Next's redirects()
  // here first, but OpenNext Cloudflare currently does not substitute
  // `:path*` tokens in destination URLs, so requests landed on the literal
  // /:path* path and 404'd. Middleware uses NextResponse.redirect and avoids
  // the templating layer entirely.
}

// The Workers emulator is only needed by the development server. Starting it
// during a production build races the build workers over its local SQLite cache.
if (process.env.NODE_ENV === 'development') {
  initOpenNextCloudflareForDev()
}

export default config

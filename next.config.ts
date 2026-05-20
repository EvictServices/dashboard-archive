import type { NextConfig } from 'next'

const eliraOrigin = process.env.ELIRA_ORIGIN ?? 'http://localhost:3000'

const nextConfig: NextConfig = {
  trailingSlash: false,
  experimental: {
    externalDir: true,
  },
  async rewrites() {
    return [
      { source: '/api/cluster/:path*', destination: `${eliraOrigin}/api/cluster/:path*` },
      { source: '/img/:path*', destination: `${eliraOrigin}/img/:path*` },
    ]
  },
}

export default nextConfig

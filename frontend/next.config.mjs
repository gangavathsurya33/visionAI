/** @type {import('next').NextConfig} */
const nextConfig = {
  allowedDevOrigins: [
    'localhost',
    '127.0.0.1',
    '192.168.1.65',
  ],

  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: 'http://127.0.0.1:8000/api/:path*',
      },
    ]
  },
}

export default nextConfig
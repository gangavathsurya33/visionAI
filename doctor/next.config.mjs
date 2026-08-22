/** @type {import('next').NextConfig} */
const nextConfig = {
  async rewrites() {
    return [
      {
        source: "/api/:path*",
        destination:
          "https://doctor-backend-production-0008.up.railway.app/:path*",
      },
    ];
  },
};

export default nextConfig;
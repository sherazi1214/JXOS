/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  experimental: {
    serverActions: {
      allowedOrigins: ['app.jasonextechnologies.com'],
    },
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '*.supabase.co',
      },
    ],
    // AVIF decoding is where a critical Next.js image-optimizer RCE lives
    // (GHSA-2xp9-vwfh-vxw4). We don't need AVIF output, so it's disabled
    // outright rather than relying on an upstream patch.
    formats: ['image/webp'],
  },
};

module.exports = nextConfig;

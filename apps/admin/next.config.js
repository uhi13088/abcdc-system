/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: ['@abc/shared', '@abc/database'],
  experimental: {
    serverActions: {
      bodySizeLimit: '2mb',
    },
    outputFileTracingIncludes: {
      '/api/**/*': [
        './node_modules/pdfkit/js/data/**/*',
        './public/fonts/**/*',
      ],
    },
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '*.supabase.co',
      },
    ],
  },
};

module.exports = nextConfig;

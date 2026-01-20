/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ['@abc/database', '@abc/shared'],
  experimental: {
    outputFileTracingIncludes: {
      '/api/**/*': [
        './node_modules/pdfkit/js/data/**/*',
        './public/fonts/**/*',
      ],
    },
  },
};

module.exports = nextConfig;

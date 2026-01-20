/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ['@abc/database', '@abc/shared'],
  experimental: {
    outputFileTracingIncludes: {
      // PDF 생성에 필요한 한글 폰트 파일 포함
      // pdfkit AFM 파일은 autoFirstPage: false 설정으로 불필요해짐
      '/api/**/*': [
        './public/fonts/**/*',
      ],
    },
  },
  // 폰트 파일이 서버 번들에 포함되도록 설정
  outputFileTracingRoot: require('path').join(__dirname, '../../'),
};

module.exports = nextConfig;

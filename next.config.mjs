/** @type {import('next').NextConfig} */
const nextConfig = {
  swcMinify: false, // 禁用 SWC 压缩，在 Android/arm64 上 SWC 二进制不可用
};

export default nextConfig;

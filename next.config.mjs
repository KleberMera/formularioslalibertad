/** @type {import('next').NextConfig} */
const nextConfig = {
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    unoptimized: true,
  },
  basePath: "/dancing-jovenes",
  assetPrefix: "/dancing-jovenes",
  output: "export",
}

export default nextConfig

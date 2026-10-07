/** @type {import('next').NextConfig} */
const nextConfig = {
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    unoptimized: true,
  },
  basePath: "/formularios",
  assetPrefix: "/formularios",
  output: "export",
}

export default nextConfig

/** @type {import('next').NextConfig} */
const nextConfig = {
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    unoptimized: true,
  },
  basePath: "/formularios-brigadas/",
  assetPrefix: "/formularios-brigadas/",
  output: "export",
}

export default nextConfig

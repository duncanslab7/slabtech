/** @type {import('next').NextConfig} */
const nextConfig = {
  // Explicitly use webpack to avoid Turbopack issues
  turbopack: {},
  serverExternalPackages: [
    '@ffmpeg-installer/ffmpeg',
    '@ffmpeg-installer/linux-x64'
  ],
  experimental: {
    serverActions: {
      bodySizeLimit: '400mb',
    },
  },
  // Optimize for Vercel Hobby plan memory limits
  webpack: (config, { isServer }) => {
    if (isServer) {
      // Reduce memory usage
      config.optimization = {
        ...config.optimization,
        moduleIds: 'deterministic',
        minimize: true,
      }
    }
    return config
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '**',
      },
      {
        protocol: 'http',
        hostname: '**',
      },
    ],
  },
};

export default nextConfig;

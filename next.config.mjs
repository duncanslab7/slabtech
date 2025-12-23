/** @type {import('next').NextConfig} */
const nextConfig = {
  serverExternalPackages: [
    '@ffmpeg-installer/ffmpeg',
    '@ffmpeg-installer/linux-x64',
    '@ricky0123/vad-node',
    'onnxruntime-node'
  ],
  experimental: {
    serverActions: {
      bodySizeLimit: '400mb',
    },
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

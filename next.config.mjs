/** @type {import('next').NextConfig} */
const nextConfig = {
  serverExternalPackages: ['sharp'],
  experimental: {
    serverComponentsExternalPackages: ['sharp'],
  },
};

export default nextConfig;

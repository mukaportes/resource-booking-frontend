/** @type {import('next').NextConfig} */
const nextConfig = {
  outputFileTracingExcludes: {
    '/*': ['./docs/**/*'],
  },
};

export default nextConfig;

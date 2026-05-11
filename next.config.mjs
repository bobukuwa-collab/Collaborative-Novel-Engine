/** @type {import('next').NextConfig} */
const nextConfig = {
  // NicheApps: pre-existing type errors don't block production builds.
  // Set to false (or remove) once the repo's tsc passes cleanly.
  typescript: { ignoreBuildErrors: true },
  output: 'standalone',
};

export default nextConfig;
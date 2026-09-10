/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: ["@ceylon/design-system", "@ceylon/shared-types"],
  output: "standalone",
};

module.exports = nextConfig;

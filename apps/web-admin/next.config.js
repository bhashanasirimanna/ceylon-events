/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: [
    "@ceylon/design-system",
    "@ceylon/shared-types",
    "@ceylon/seatmap-ui",
  ],
  output: "standalone",
  webpack: (config) => {
    // konva's Node entry point (pulled in transitively via react-konva)
    // requires the native `canvas` package, which we don't install. Alias
    // it to `false` so webpack stubs it out with an empty module instead
    // of trying to resolve it — needed for both the client and server
    // compilations, and more reliable than `externals` (which didn't take
    // effect consistently between `next dev` and `next build`).
    config.resolve.alias = {
      ...config.resolve.alias,
      canvas: false,
    };
    return config;
  },
};

module.exports = nextConfig;

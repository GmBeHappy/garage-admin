import type {NextConfig} from "next";
export default {
  output:"standalone",
  webpack(config, {isServer}) {
    if (isServer) config.externals.push({"bun:sqlite":"commonjs bun:sqlite"});
    return config;
  }
} satisfies NextConfig;

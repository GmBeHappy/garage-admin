export default {
  webpack(config, {isServer}) {
    if (isServer) config.externals.push({"bun:sqlite":"commonjs bun:sqlite"});
    return config;
  }
};

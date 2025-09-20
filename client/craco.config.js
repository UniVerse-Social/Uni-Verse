// client/craco.config.js
module.exports = {
  webpack: {
    configure: (config) => {
      // Silence only the noisy chess.js sourcemap warning
      config.ignoreWarnings = [
        ...(config.ignoreWarnings || []),
        (warning) =>
          /Failed to parse source map/.test(warning.message || '') &&
          warning.module &&
          warning.module.resource &&
          /node_modules[\\/](chess\.js)/.test(warning.module.resource),
      ];
      return config;
    },
  },
};

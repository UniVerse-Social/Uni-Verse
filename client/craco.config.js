// client/craco.config.js
module.exports = {
  webpack: {
    configure: (config) => {
      // Keep your existing warning filter
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

  // NEW: steer webpack-dev-server to compute the WS URL from the page's origin
  devServer: (config) => {
    config.allowedHosts = 'all'; // allow *.trycloudflare.com
    config.client = config.client || {};
    // "auto" scheme + host; no hard-coded :3000 so tunnels work
    config.client.webSocketURL = 'auto://0.0.0.0/ws';
    return config;
  },
};

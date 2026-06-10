/** @type {import('next').NextConfig} */
const path = require('path');

const nextConfig = {
  outputFileTracingRoot: path.resolve(__dirname, '..'),
  experimental: {
    serverActions: {
      bodySizeLimit: '2mb',
    },
  },
  // The harness imports pipeline modules from ../src — allow that.
  webpack: (config) => {
    config.resolve.alias['@pipeline'] = path.resolve(__dirname, '../src');
    config.resolve.extensionAlias = {
      ...config.resolve.extensionAlias,
      '.js': ['.ts', '.tsx', '.js'],
      '.mjs': ['.mts', '.mjs'],
    };
    return config;
  },
  // better-sqlite3 is a native module — don't try to bundle it.
  serverExternalPackages: ['better-sqlite3'],
};

module.exports = nextConfig;

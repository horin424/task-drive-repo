import type { NextConfig } from "next";
import pkg from './package.json';

const nextConfig: NextConfig = {
  output: 'export',
  env: {
    APP_VERSION: process.env.npm_package_version || pkg.version,
  },
};

export default nextConfig;

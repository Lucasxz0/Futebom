import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  turbopack: {},
  // Permite acesso HMR de outros IPs na rede
  allowedDevOrigins: ["192.168.0.123", "localhost", "127.0.0.1"],
};

export default nextConfig;

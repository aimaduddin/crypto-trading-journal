declare module "next-pwa" {
  import type { NextConfig } from "next";

  type WithPWAOptions = Record<string, unknown>;

  export default function withPWA(
    options?: WithPWAOptions,
  ): (nextConfig?: NextConfig) => NextConfig;
}

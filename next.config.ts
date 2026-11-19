import type { NextConfig } from "next";

// Ruling: cacheComponents/partialPrefetching отключены — все данные динамические (дневники, signed URLs),
// а страницы-клиенты проще без обязательных Suspense-границ.
const nextConfig: NextConfig = {
  turbopack: {
    root: __dirname,
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;

import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    // Uploaded photos (profile, pet, clinic) are served from the public
    // Vercel Blob store, whose hostname carries the store id.
    remotePatterns: [
      {
        protocol: "https",
        hostname: "*.public.blob.vercel-storage.com",
      },
    ],
  },
};

export default nextConfig;

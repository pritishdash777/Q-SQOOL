const nextConfig = {
  turbopack: {
    root: process.cwd(),
  },
  async headers() {
    return [{
      source: "/login",
      headers: [
        { key: "Cross-Origin-Opener-Policy", value: "same-origin-allow-popups" },
        { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
      ],
    }];
  },
};

export default nextConfig;

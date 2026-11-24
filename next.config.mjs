/** @type {import('next').NextConfig} */
const supabaseHost = (() => {
  try {
    return new URL(process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").hostname;
  } catch {
    return "";
  }
})();

const nextConfig = {
  poweredByHeader: false, // não anuncia a tecnologia do servidor
  productionBrowserSourceMaps: false, // não publica o código-fonte original
  reactStrictMode: true,
  serverExternalPackages: ["sharp", "web-push", "ffmpeg-static"],
  outputFileTracingIncludes: { "/api/app/midia/processar": ["./node_modules/ffmpeg-static/ffmpeg"] },
  images: {
    formats: ["image/avif", "image/webp"],
    remotePatterns: supabaseHost ? [{ protocol: "https", hostname: supabaseHost, pathname: "/storage/v1/object/public/**" }] : [],
  },
  async headers() {
    // arquivos estáticos (o middleware cobre as páginas)
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
        ],
      },
      { source: "/sw.js", headers: [{ key: "Cache-Control", value: "no-cache" }, { key: "Service-Worker-Allowed", value: "/" }] },
    ];
  },
};

export default nextConfig;

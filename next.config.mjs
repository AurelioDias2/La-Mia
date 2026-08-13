/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // argon2 é um módulo nativo (binário compilado) — sem isso, o bundler da
  // Vercel não inclui o binário certo no pacote da função serverless e o
  // login falha em produção com "No native build was found".
  experimental: {
    serverComponentsExternalPackages: ["argon2"],
  },
};

export default nextConfig;

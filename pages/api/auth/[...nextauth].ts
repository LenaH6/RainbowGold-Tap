import NextAuth, { type NextAuthOptions } from "next-auth";

export const authOptions: NextAuthOptions = {
  providers: [
    {
      id: "worldcoin",
      name: "Worldcoin",
      type: "oauth", // usamos el proveedor genérico
      wellKnown: "https://id.worldcoin.org/.well-known/openid-configuration",
      clientId: process.env.WLD_CLIENT_ID!,
      clientSecret: process.env.WLD_CLIENT_SECRET!,
      authorization: { params: { scope: "openid email profile" } },
      checks: ["pkce", "state"],
      profile(profile: any) {
        return {
          id: profile.sub || profile.id,
          name: profile.name || profile.preferred_username || "World ID user",
          email: profile.email ?? null,
          image: profile.picture ?? null,
        };
      },
    } as any, // para evitar que TS se queje con tipos estrictos
  ],
  callbacks: {
    async jwt({ token, account }) {
      if (account) token.provider = account.provider;
      return token;
    },
  async session({ session, token }) {
      (session as any).provider = token.provider;
      return session;
    },
  },
};

export default NextAuth(authOptions);

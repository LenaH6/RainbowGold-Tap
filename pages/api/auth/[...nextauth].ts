// pages/api/auth/[...nextauth].ts
import NextAuth, { type NextAuthOptions } from "next-auth";
import jwtLib from "jsonwebtoken";

/**
 * Usamos un provider OAuth “custom” con OIDC discovery.
 * No dependemos de next-auth/providers/worldcoin.
 */
export const authOptions: NextAuthOptions = {
  providers: [
    {
      id: "worldcoin",
      name: "Worldcoin",
      type: "oauth",
      wellKnown: "https://id.worldcoin.org/.well-known/openid-configuration",
      clientId: process.env.WLD_CLIENT_ID!,
      clientSecret: process.env.WLD_CLIENT_SECRET!,
      authorization: { params: { scope: "openid profile email" } },
      idToken: true,
      checks: ["pkce", "state"],
      profile(profile: any) {
        // Normaliza mínimamente el perfil
        return {
          id: profile.sub || profile.id,
          name: profile.name || profile.preferred_username || "World ID user",
          email: profile.email ?? null,
          image: profile.picture ?? null,
        };
      },
    } as any,
  ],

  callbacks: {
    /**
     * Aquí generamos el JWT de TU app (appToken) firmado con JWT_SECRET.
     * Lo mapeamos con userId = sub (id de World ID).
     */
    async jwt({ token, account, profile }) {
      // Cuando llega de un nuevo login, guardamos el id de Worldcoin
      if (account?.provider === "worldcoin") {
        const sub =
          (profile as any)?.sub ||
          (profile as any)?.id ||
          account.providerAccountId;
        token.worldcoinId = sub;
      }

      // Firmar tu propio token para el backend
      if (token.worldcoinId && process.env.JWT_SECRET) {
        token.appToken = jwtLib.sign(
          { userId: token.worldcoinId },
          process.env.JWT_SECRET,
          { expiresIn: "1h" }
        );
      }

      return token;
    },

    /**
     * Exponemos appToken en la sesión que llega al cliente.
     */
    async session({ session, token }) {
      (session as any).appToken = token.appToken ?? null;
      (session as any).worldcoinId = token.worldcoinId ?? null;
      return session;
    },
  },
};

export default NextAuth(authOptions);

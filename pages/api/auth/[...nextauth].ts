import NextAuth, { type NextAuthOptions } from "next-auth";
import Worldcoin from "next-auth/providers/worldcoin";

export const authOptions: NextAuthOptions = {
  providers: [
    Worldcoin({
      clientId: process.env.WLD_CLIENT_ID!,
      clientSecret: process.env.WLD_CLIENT_SECRET!,
    }),
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

import { NextAuthOptions } from "next-auth";
import GoogleProvider from "next-auth/providers/google";

export const authOptions: NextAuthOptions = {
    providers: [
        GoogleProvider({
            clientId: process.env.GOOGLE_CLIENT_ID!,
            clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
        }),
    ],
    session: {
        strategy: "jwt",
        maxAge: 4 * 60 * 60, // 4 hours - session expires after 4 hours of inactivity
    },
    callbacks: {
        session: async ({ session, token }) => {
            if (session.user) {
                // @ts-ignore
                session.user.id = token.sub;
            }
            return session;
        },
    },
};

import type { Metadata } from "next";
import { Inter, Oswald } from "next/font/google";
import "./globals.css";
import { RoleProvider } from "@/contexts/role-context";
import { ThemeProvider } from "@/lib/theme";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

const oswald = Oswald({
  variable: "--font-oswald",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Sweatbox Admin - Dashboard",
  description: "Sweatbox Admin",
};

/*
 * Applies the stored theme before the first paint.
 *
 * ThemeProvider can only set `data-theme` after hydration, which is long enough
 * for a light-mode user to see a full dark flash. Reading the same key here, in
 * a blocking script, removes it. Kept deliberately tiny and failure-tolerant:
 * blocked storage just leaves the default dark markup alone.
 */
const themeBootScript = `try{var t=localStorage.getItem("sweatbox.theme")||localStorage.getItem("sweatbox.pos.theme");document.documentElement.setAttribute("data-theme",t==="light"?"light":"dark")}catch(e){}`;

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="id"
      className={`${inter.variable} ${oswald.variable} h-full antialiased`}
      data-theme="dark"
      suppressHydrationWarning
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeBootScript }} />
      </head>
      <body className="min-h-screen overflow-x-hidden flex flex-col">
        <ThemeProvider>
          <RoleProvider>{children}</RoleProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}

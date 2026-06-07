import type { Metadata } from "next";
import { GeistSans } from "geist/font/sans";


import { GeistPixelSquare } from "geist/font/pixel";
import { NotchNav } from "@/components/ui/notch-nav";
import { ThemeProvider } from "@/components/ui/theme-provider"



import "./globals.css";
import { ClerkProvider } from "@clerk/nextjs";

type NavIcon = "home" | "dashboard" | "upload" | "compare";

const navItems: Array<{ value: string; label: string; href: string; icon: NavIcon }> = [
  { value: "home", label: "Home", href: "/", icon: "home" },
  { value: "dashboard", label: "Dashboard", href: "/dashboard", icon: "dashboard" },
  { value: "upload", label: "Upload", href: "/upload", icon: "upload" },
  { value: "compare", label: "Compare", href: "/dashboard/compare", icon: "compare" },
];

export const metadata: Metadata = {
  title: "Idle to ideal",
  description: "Move idle stock to where it sells",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${GeistSans.variable} ${GeistPixelSquare.variable} h-full antialiased`}
    >
      <body
        suppressHydrationWarning
        className="min-h-full flex flex-col bg-background text-foreground"
      >
        <ClerkProvider>
        <ThemeProvider>
          <header className="border-b border-border bg-card/90 backdrop-blur">
            <div className="mx-auto flex w-full max-w-7xl items-center justify-between gap-4 px-4 py-4 sm:px-6">
              <NotchNav
                items={navItems}
                defaultValue="home"
                ariaLabel="Primary navigation"
              />
            </div>
          </header>
          <main className="flex-1 overflow-x-auto">
            {children}
            
          </main>
        </ThemeProvider>
        </ClerkProvider>
      </body>
    </html>
  );
}

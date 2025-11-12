import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import Link from "next/link";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "VisuaRealm",
  description: "Creative AI visual chat powered by GPT",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={inter.className}>
      <body className="bg-[#0d0d0d] text-gray-100 min-h-screen pb-20 relative">
        {/* Page Content */}
        <div className="flex flex-col min-h-screen">{children}</div>

        {/* 🔻 Bottom Navigation Bar */}
        <nav className="fixed bottom-0 left-0 right-0 bg-gradient-to-r from-purple-600 to-blue-600 flex justify-around items-center py-3 shadow-2xl border-t border-white/10 z-50">
          {[
            { label: "Chat", path: "/" },
            { label: "Research", path: "/research" },
            { label: "Notepad", path: "/notepad" },
            { label: "Goals", path: "/goals" },
          ].map((item, i) => (
            <Link
              key={i}
              href={item.path}
              className="flex flex-col items-center text-white/90 hover:text-white transition"
            >
              <span className="text-lg">●</span>
              <span className="text-xs font-medium">{item.label}</span>
            </Link>
          ))}
        </nav>
      </body>
    </html>
  );
}

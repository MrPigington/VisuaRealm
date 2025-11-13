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
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body
        className={`${inter.className} bg-[#0d0d0d] text-gray-100 min-h-screen pb-24 relative`}
      >
        {/* Main content area */}
        <div className="flex flex-col min-h-screen">{children}</div>

        {/* 🔻 Persistent bottom navigation */}
        <nav className="fixed bottom-0 left-0 right-0 bg-gradient-to-r from-purple-600 to-blue-600 flex justify-around items-center py-3 shadow-[0_-2px_12px_rgba(0,0,0,0.5)] border-t border-white/10 z-50">
          {[
            { label: "Flow", path: "/" },            // 🆕 Renamed from Main
            { label: "Chat", path: "/chat" },
            { label: "Image Gen", path: "/image" },  // 🆕 New tab
            { label: "Whiteboard", path: "/whiteboard" },
            { label: "Notepad", path: "/notepad" },
          ].map((item, i) => (
            <Link
              key={i}
              href={item.path}
              className="flex flex-col items-center justify-center text-white/90 hover:text-white transition w-full"
            >
              <span className="text-lg leading-none mb-1">●</span>
              <span className="text-xs font-medium">{item.label}</span>
            </Link>
          ))}
        </nav>
      </body>
    </html>
  );
}

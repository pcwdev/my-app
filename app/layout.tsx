import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Analytics } from "@vercel/analytics/next";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "맞냐 - 지금 이 선택, 진짜 맞냐?",
  description:
    "연애, 직장, 돈, 인간관계 고민을 익명으로 LEFT/RIGHT 선택하고 사람들 의견을 확인해보세요.",
  metadataBase: new URL("https://www.matya.kr"),
  openGraph: {
    title: "맞냐 - 지금 이 선택, 진짜 맞냐?",
    description:
      "너라면 어떻게 할래? 익명으로 선택하고 사람들 의견을 확인해보세요.",
    url: "https://www.matya.kr",
    siteName: "맞냐",
    type: "website",
    locale: "ko_KR",
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: "맞냐",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "맞냐 - 지금 이 선택, 진짜 맞냐?",
    description: "익명으로 선택하고 사람들 의견을 확인해보세요.",
    images: ["/og-image.png"],
  },
  verification: {
    other: {
      "naver-site-verification":
        "1c1c6e4255b0cbfe4e8dc4d4c85ea5256f0ee82e",
    },
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="ko"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        {children}
        <Analytics />
      </body>
    </html>
  );
}

import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Admin · Unlock Menu",
  robots: { index: false, follow: false },
  icons: { icon: "/brand/icon.svg" },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return <div className="min-h-dvh">{children}</div>;
}

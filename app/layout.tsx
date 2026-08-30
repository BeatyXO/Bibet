import type { Metadata } from "next";
import { WalletProvider } from "../components/wallet-provider";
import "./globals.css";
export const metadata: Metadata = { title: "BIBET — Fund what proved its value", description: "Retroactive public goods funding with GenLayer consensus." };
export default function RootLayout({ children }: Readonly<{children: React.ReactNode}>) { return <html lang="en"><body><WalletProvider>{children}</WalletProvider></body></html>; }

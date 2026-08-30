"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ExternalLink, Menu, Wallet, X } from "lucide-react";
import { useState } from "react";
import { shortAddress } from "../lib/wallet";
import { useWallet } from "./wallet-provider";

const links = [
  { href: "/rounds", label: "Rounds" },
  { href: "/start", label: "Start round" },
  { href: "/how", label: "How it works" },
  { href: "/audit", label: "Audit" },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [mobile, setMobile] = useState(false);
  const { address, mode, openWallet } = useWallet();
  const walletLabel = address ? shortAddress(address) : mode === "none" ? "Connect wallet" : "Wallet ready";

  return (
    <main>
      <header className="nav">
        <Link className="brand" href="/"><span className="brandMark">B</span><span>BIBET</span></Link>
        <nav>{links.map((link) => <Link className={pathname === link.href ? "active" : ""} href={link.href} key={link.href}>{link.label}</Link>)}</nav>
        <div className="navActions">
          <span className="network"><i /> STUDIONET</span>
          <button className="walletBtn" onClick={openWallet}><Wallet size={15} />{walletLabel}</button>
          <button className="menu" onClick={() => setMobile(!mobile)} aria-label="Open navigation">{mobile ? <X size={20} /> : <Menu size={20} />}</button>
        </div>
      </header>
      {mobile && <div className="mobileNav">{links.map((link) => <Link href={link.href} key={link.href} onClick={() => setMobile(false)}>{link.label}</Link>)}</div>}
      {children}
      <footer>
        <Link className="brand" href="/"><span className="brandMark">B</span><span>BIBET</span></Link>
        <span>Fund what proved its value.</span>
        <span className="footerRight">GenLayer Studionet · <a href="https://explorer-studio.genlayer.com" target="_blank">Explorer <ExternalLink size={12} /></a></span>
      </footer>
    </main>
  );
}

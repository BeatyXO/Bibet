"use client";

import { createContext, useContext, useMemo, useState } from "react";
import { Check, ChevronRight, Copy, Layers3, Loader2, ShieldCheck, Wallet, X } from "lucide-react";
import {
  connectInjectedWallet,
  createGeneratedKey,
  getGeneratedAddress,
  getGeneratedKey,
  hasInjectedWallet,
  shortAddress,
} from "../lib/wallet";

type ActiveWalletMode = "none" | "injected" | "generated";
type WalletContextValue = { address: string | null; mode: ActiveWalletMode; openWallet: () => void };
const WalletContext = createContext<WalletContextValue | null>(null);

export function useWallet() {
  const value = useContext(WalletContext);
  if (!value) throw new Error("useWallet must be used inside WalletProvider");
  return value;
}

export function WalletProvider({ children }: { children: React.ReactNode }) {
  const [walletOpen, setWalletOpen] = useState(false);
  const [mode, setMode] = useState<ActiveWalletMode>("none");
  const [address, setAddress] = useState<string | null>(null);
  const [walletError, setWalletError] = useState<string | null>(null);
  const [connecting, setConnecting] = useState<"injected" | "generated" | null>(null);

  async function chooseInjected() {
    setWalletError(null);
    setConnecting("injected");
    try {
      const account = await connectInjectedWallet();
      setAddress(account);
      setMode("injected");
      setWalletOpen(false);
    } catch (error) {
      setWalletError(error instanceof Error ? error.message : "Injected wallet connection failed.");
    } finally {
      setConnecting(null);
    }
  }

  function chooseGenerated() {
    setWalletError(null);
    setConnecting("generated");
    try {
      getGeneratedKey() || createGeneratedKey();
      const account = getGeneratedAddress();
      if (!account) throw new Error("Could not create browser wallet.");
      setAddress(account);
      setMode("generated");
      setWalletOpen(false);
    } catch (error) {
      setWalletError(error instanceof Error ? error.message : "Browser wallet creation failed.");
    } finally {
      setConnecting(null);
    }
  }

  const value = useMemo(() => ({ address, mode, openWallet: () => setWalletOpen(true) }), [address, mode]);

  return (
    <WalletContext.Provider value={value}>
      {children}
      {walletOpen && (
        <div className="overlay" onClick={() => setWalletOpen(false)}>
          <div className="walletModal" onClick={(event) => event.stopPropagation()}>
            <button className="close" onClick={() => setWalletOpen(false)} aria-label="Close wallet modal">
              <X size={18} />
            </button>
            <div className="sectionKicker">IDENTITY REQUIRED FOR WRITES</div>
            <h2>Choose your wallet mode</h2>
            <p className="modalIntro">
              BIBET reads publicly without a wallet. Choose how you’ll sign transactions when you’re ready to create or
              fund a round.
            </p>
            <button className="walletOption" onClick={chooseInjected} disabled={!!connecting}>
              <span className="optionIcon"><Wallet size={19} /></span>
              <span>
                <b>Injected wallet</b>
                <small>{hasInjectedWallet() ? "Connect MetaMask, Rabby or any EIP-1193 wallet" : "No injected wallet detected in this browser"}</small>
              </span>
              {connecting === "injected" ? <Loader2 className="spin" size={17} /> : <ChevronRight size={17} />}
            </button>
            <button className="walletOption" onClick={chooseGenerated} disabled={!!connecting}>
              <span className="optionIcon browser"><Layers3 size={19} /></span>
              <span>
                <b>Browser wallet</b>
                <small>Generate and persist a local signing identity</small>
              </span>
              {connecting === "generated" ? <Loader2 className="spin" size={17} /> : <ChevronRight size={17} />}
            </button>
            {address && (
              <div className="walletState">
                <Check size={15} />
                <span>{mode === "injected" ? "Injected wallet connected" : "Browser wallet ready"}: <b>{shortAddress(address)}</b></span>
                <button onClick={() => navigator.clipboard?.writeText(address)} aria-label="Copy wallet address">
                  <Copy size={14} />
                </button>
              </div>
            )}
            {walletError && <div className="walletError">{walletError}</div>}
            <div className="warning">
              <ShieldCheck size={15} />
              <span>Browser wallets are stored in this browser only. Export your key before clearing site data. This is not custody-grade.</span>
            </div>
          </div>
        </div>
      )}
    </WalletContext.Provider>
  );
}

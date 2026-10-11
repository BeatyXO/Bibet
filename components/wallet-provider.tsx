"use client";
import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { Copy, Wallet, X } from "lucide-react";
import { connectInjectedWallet, getInjectedWalletState, hasInjectedWallet, shortAddress, switchInjectedChain } from "../lib/wallet";
import { BIBET_CHAIN } from "../lib/config";

type WalletContextValue = { address: string | null; mode: "none" | "injected"; openWallet: () => void };
const WalletContext = createContext<WalletContextValue | null>(null);
export function useWallet() { const value = useContext(WalletContext); if (!value) throw new Error("useWallet must be used inside WalletProvider"); return value; }

export function WalletProvider({ children }: { children: React.ReactNode }) {
  const [walletOpen, setWalletOpen] = useState(false);
  const [address, setAddress] = useState<string | null>(null);
  const [walletError, setWalletError] = useState<string | null>(null);
  const [connecting, setConnecting] = useState(false);
  const [switchingNetwork, setSwitchingNetwork] = useState(false);
  async function connect() {
    setWalletError(null); setConnecting(true);
    try { setAddress(await connectInjectedWallet(BIBET_CHAIN)); setWalletOpen(false); }
    catch (error) { setWalletError(error instanceof Error ? error.message : "Wallet connection failed."); }
    finally { setConnecting(false); }
  }
  async function switchNetwork() {
    setWalletError(null); setSwitchingNetwork(true);
    try {
      await switchInjectedChain(BIBET_CHAIN);
      const accounts = await window.ethereum?.request({ method: "eth_accounts" });
      setAddress(Array.isArray(accounts) && typeof accounts[0] === "string" ? accounts[0] : null);
      setWalletError(null);
    } catch (error) {
      setWalletError(error instanceof Error ? error.message : "Could not switch wallet network.");
    } finally { setSwitchingNetwork(false); }
  }
  useEffect(() => {
    const provider = window.ethereum;
    if (!provider) return;
    let active = true;
    const onAccounts = (value: unknown) => setAddress(Array.isArray(value) && typeof value[0] === "string" ? value[0] : null);
    const onChain = (value: unknown) => {
      if (typeof value !== "string" || value.toLowerCase() !== `0x${BIBET_CHAIN.id.toString(16)}`) {
        setWalletError(`Wrong network. Switch your wallet to ${BIBET_CHAIN.name} (chain ${BIBET_CHAIN.id}).`);
        return;
      }
      void provider.request({ method: "eth_accounts" }).then(accounts => {
        setAddress(Array.isArray(accounts) && typeof accounts[0] === "string" ? accounts[0] : null);
        setWalletError(null);
      }).catch(() => setWalletError("Network switched. Reopen your wallet to reconnect."));
    };
    provider.on?.("accountsChanged", onAccounts); provider.on?.("chainChanged", onChain);
    // Restore an already-authorized account after reload without prompting for
    // access again. eth_accounts is read-only and returns [] when not connected.
    void getInjectedWalletState(BIBET_CHAIN)
      .then(({ address: authorizedAddress, onExpectedChain }) => {
        if (!active) return;
        setAddress(authorizedAddress);
        if (onExpectedChain === false) setWalletError(`Wrong network. Switch your wallet to ${BIBET_CHAIN.name} (chain ${BIBET_CHAIN.id}).`);
        else if (onExpectedChain === true) setWalletError(null);
      })
      .catch(() => { /* Wallet may be locked or unavailable; the user can connect manually. */ });
    return () => {
      active = false;
      provider.removeListener?.("accountsChanged", onAccounts);
      provider.removeListener?.("chainChanged", onChain);
    };
  }, []);
  const value = useMemo(() => ({ address, mode: address ? "injected" as const : "none" as const, openWallet: () => setWalletOpen(true) }), [address]);
  return <WalletContext.Provider value={value}>{children}{walletOpen && <div className="overlay" onClick={() => setWalletOpen(false)}><div className="walletModal" onClick={event => event.stopPropagation()}>
    <button className="close" onClick={() => setWalletOpen(false)} aria-label="Close wallet modal"><X size={18} /></button>
    <div className="sectionKicker">IDENTITY REQUIRED FOR WRITES</div><h2>Connect wallet</h2>
    <p className="modalIntro">Use an injected EIP-1193 wallet on GenLayer Studionet.</p>
    <button className="walletOption" onClick={connect} disabled={connecting || !hasInjectedWallet()}><Wallet size={19} /><span><b>Injected wallet</b><small>{hasInjectedWallet() ? "Connect wallet" : "No injected wallet detected"}</small></span></button>
    {address && <div className="walletState"><span>{shortAddress(address)}</span><button onClick={() => navigator.clipboard?.writeText(address)} aria-label="Copy wallet address"><Copy size={14} /></button><button onClick={() => { setAddress(null); setWalletOpen(false); }}>Disconnect</button></div>}
    {walletError && (walletError.startsWith("Wrong network.")
      ? <button className="walletError walletErrorAction" onClick={switchNetwork} disabled={switchingNetwork || !hasInjectedWallet()} aria-label={`Switch wallet to ${BIBET_CHAIN.name}`}>
          {switchingNetwork ? "Waiting for wallet…" : <>{walletError} <span className="walletErrorHint">Click to switch network</span></>}
        </button>
      : <div className="walletError" role="status">{walletError}</div>)}
  </div></div>}</WalletContext.Provider>;
}

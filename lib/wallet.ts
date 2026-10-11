import type { Chain } from "viem";

export function hasInjectedWallet() { return typeof window !== "undefined" && !!window.ethereum; }
export function shortAddress(address: string) { return `${address.slice(0, 6)}...${address.slice(-4)}`; }
export async function ensureInjectedChain(chain: Chain) {
  if (!window.ethereum) throw new Error("No injected wallet detected.");
  const current = await window.ethereum.request({ method: "eth_chainId" });
  if (typeof current !== "string" || current.toLowerCase() !== `0x${chain.id.toString(16)}`) {
    throw new Error(`Wrong network. Switch your wallet to ${chain.name} (chain ${chain.id}).`);
  }
}
export async function connectInjectedWallet(chain: Chain) {
  if (!hasInjectedWallet()) throw new Error("No injected EIP-1193 wallet detected.");
  const accounts = await window.ethereum!.request({ method: "eth_requestAccounts" });
  if (!Array.isArray(accounts) || typeof accounts[0] !== "string") throw new Error("Wallet did not return an account.");
  await ensureInjectedChain(chain);
  return accounts[0];
}
declare global { interface Window { ethereum?: { request: (args: {method:string; params?: unknown[] | Record<string, unknown>[]}) => Promise<unknown>; on?: (event:string, handler:(value: unknown)=>void)=>void; removeListener?: (event:string, handler:(value: unknown)=>void)=>void } } }

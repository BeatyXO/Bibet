import type { Chain } from "viem";

export function hasInjectedWallet() { return typeof window !== "undefined" && !!window.ethereum; }
export function shortAddress(address: string) { return `${address.slice(0, 6)}...${address.slice(-4)}`; }
export async function getInjectedWalletState(chain: Chain) {
  if (!window.ethereum) return { address: null, onExpectedChain: null };
  const [accounts, chainId] = await Promise.all([
    window.ethereum.request({ method: "eth_accounts" }),
    window.ethereum.request({ method: "eth_chainId" }),
  ]);
  return {
    address: Array.isArray(accounts) && typeof accounts[0] === "string" ? accounts[0] : null,
    onExpectedChain: typeof chainId === "string" && chainId.toLowerCase() === `0x${chain.id.toString(16)}`,
  };
}
export async function switchInjectedChain(chain: Chain) {
  if (!window.ethereum) throw new Error("No injected EIP-1193 wallet detected.");
  const chainId = `0x${chain.id.toString(16)}`;
  try {
    await window.ethereum.request({ method: "wallet_switchEthereumChain", params: [{ chainId }] });
  } catch (error) {
    if (typeof error !== "object" || error === null || !("code" in error) || error.code !== 4902) throw error;
    await window.ethereum.request({
      method: "wallet_addEthereumChain",
      params: [{
        chainId,
        chainName: chain.name,
        rpcUrls: chain.rpcUrls.default.http,
        nativeCurrency: chain.nativeCurrency,
        ...(chain.blockExplorers?.default?.url ? { blockExplorerUrls: [chain.blockExplorers.default.url] } : {}),
      }],
    });
    await window.ethereum.request({ method: "wallet_switchEthereumChain", params: [{ chainId }] });
  }
}
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

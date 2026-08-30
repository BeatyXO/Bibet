import { createAccount } from 'genlayer-js';
import type { Chain } from 'viem';

export type WalletMode = 'injected' | 'generated';
export const WALLET_KEY = 'bibet.browser-wallet.private-key';
export function hasInjectedWallet() { return typeof window !== 'undefined' && !!window.ethereum; }
export function getGeneratedKey() { return typeof window !== 'undefined' ? localStorage.getItem(WALLET_KEY) : null; }
export function createGeneratedKey() { const bytes = new Uint8Array(32); crypto.getRandomValues(bytes); const key = '0x' + Array.from(bytes).map(b=>b.toString(16).padStart(2,'0')).join(''); localStorage.setItem(WALLET_KEY,key); return key; }
export function getGeneratedAddress() { const key = getGeneratedKey(); return key ? createAccount(key as `0x${string}`).address : null; }
export async function connectInjectedWallet(chain?: Chain) {
  if (!hasInjectedWallet()) throw new Error('No injected wallet detected. Install or unlock MetaMask/Rabby and refresh.');
  const accounts = await window.ethereum!.request({ method: 'eth_requestAccounts' });
  if (!Array.isArray(accounts) || typeof accounts[0] !== 'string') throw new Error('Injected wallet did not return an account.');
  if (chain?.id) await ensureInjectedChain(chain);
  return accounts[0];
}
export function shortAddress(address: string) { return `${address.slice(0, 6)}...${address.slice(-4)}`; }

async function ensureInjectedChain(chain: Chain) {
  const chainId = `0x${chain.id.toString(16)}`;
  const current = await window.ethereum!.request({ method: 'eth_chainId' });
  if (typeof current === 'string' && current.toLowerCase() === chainId.toLowerCase()) return;
  try {
    await window.ethereum!.request({ method: 'wallet_switchEthereumChain', params: [{ chainId }] });
  } catch (error) {
    const code = typeof error === 'object' && error && 'code' in error ? Number((error as { code: unknown }).code) : 0;
    if (code !== 4902) throw error;
    await window.ethereum!.request({
      method: 'wallet_addEthereumChain',
      params: [{
        chainId,
        chainName: chain.name,
        nativeCurrency: chain.nativeCurrency,
        rpcUrls: [...chain.rpcUrls.default.http],
        blockExplorerUrls: chain.blockExplorers?.default?.url ? [chain.blockExplorers.default.url] : undefined,
      }],
    });
  }
}

declare global { interface Window { ethereum?: { request: (args: {method:string; params?: unknown[] | Record<string, unknown>[]}) => Promise<unknown>; on?: (event:string, handler:(value: unknown)=>void)=>void; removeListener?: (event:string, handler:(value: unknown)=>void)=>void } } }

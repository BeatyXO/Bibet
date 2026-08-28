import { createAccount } from 'genlayer-js';

export type WalletMode = 'injected' | 'generated';
export const WALLET_KEY = 'bibet.browser-wallet.private-key';
export function hasInjectedWallet() { return typeof window !== 'undefined' && !!window.ethereum; }
export function getGeneratedKey() { return typeof window !== 'undefined' ? localStorage.getItem(WALLET_KEY) : null; }
export function createGeneratedKey() { const bytes = new Uint8Array(32); crypto.getRandomValues(bytes); const key = '0x' + Array.from(bytes).map(b=>b.toString(16).padStart(2,'0')).join(''); localStorage.setItem(WALLET_KEY,key); return key; }
export function getGeneratedAddress() { const key = getGeneratedKey(); return key ? createAccount(key as `0x${string}`).address : null; }
export async function connectInjectedWallet() {
  if (!hasInjectedWallet()) throw new Error('No injected wallet detected. Install or unlock MetaMask/Rabby and refresh.');
  const accounts = await window.ethereum!.request({ method: 'eth_requestAccounts' });
  if (!Array.isArray(accounts) || typeof accounts[0] !== 'string') throw new Error('Injected wallet did not return an account.');
  return accounts[0];
}
export function shortAddress(address: string) { return `${address.slice(0, 6)}...${address.slice(-4)}`; }
declare global { interface Window { ethereum?: { request: (args: {method:string; params?: unknown[]}) => Promise<unknown> } } }

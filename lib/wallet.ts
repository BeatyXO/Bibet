export type WalletMode = 'injected' | 'generated';
export const WALLET_KEY = 'bibet.browser-wallet.private-key';
export function hasInjectedWallet() { return typeof window !== 'undefined' && !!window.ethereum; }
export function getGeneratedKey() { return typeof window !== 'undefined' ? localStorage.getItem(WALLET_KEY) : null; }
export function createGeneratedKey() { const bytes = new Uint8Array(32); crypto.getRandomValues(bytes); const key = '0x' + Array.from(bytes).map(b=>b.toString(16).padStart(2,'0')).join(''); localStorage.setItem(WALLET_KEY,key); return key; }
declare global { interface Window { ethereum?: { request: (args: {method:string; params?: unknown[]}) => Promise<unknown> } } }

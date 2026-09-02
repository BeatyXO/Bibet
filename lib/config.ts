import { createAccount, createClient } from "genlayer-js";
import { studionet, testnetBradbury } from "genlayer-js/chains";

const DEFAULT_CONTRACT = "0x3F3F320e9767c6Ac9b8c418c3d7FB416B740c4Cf";
const DEFAULT_EXPLORER = "https://explorer-studio.genlayer.com";

function contractAddress() {
  const value = process.env.NEXT_PUBLIC_GENLAYER_CONTRACT_ADDRESS || DEFAULT_CONTRACT;
  if (!/^0x[a-fA-F0-9]{40}$/.test(value)) {
    throw new Error("NEXT_PUBLIC_GENLAYER_CONTRACT_ADDRESS must be a valid 20-byte hex address.");
  }
  return value as `0x${string}`;
}

export const BIBET_NETWORK = process.env.NEXT_PUBLIC_GENLAYER_NETWORK || "studionet";
export const BIBET_CHAIN =
  BIBET_NETWORK === "studionet" ? studionet : BIBET_NETWORK === "bradbury" ? testnetBradbury : failUnsupportedNetwork();
export const BIBET_CONTRACT = contractAddress();
export const BIBET_EXPLORER_URL = (process.env.NEXT_PUBLIC_GENLAYER_EXPLORER_URL || DEFAULT_EXPLORER).replace(/\/+$/, "");
export const readClient = createClient({ chain: BIBET_CHAIN, account: createAccount() });

export function explorerTx(hash: string) {
  return `${BIBET_EXPLORER_URL}/transactions/${hash}`;
}

export function explorerContract(address = BIBET_CONTRACT) {
  return `${BIBET_EXPLORER_URL}/contracts/${address}`;
}

function failUnsupportedNetwork(): never {
  throw new Error(`Unsupported NEXT_PUBLIC_GENLAYER_NETWORK: ${BIBET_NETWORK}. Use studionet or bradbury.`);
}

import { createClient, createAccount } from 'genlayer-js';
import { studionet } from 'genlayer-js/chains';

export const BIBET_CONTRACT = '0xF57Cbf73d00A3d2d1Dc35EBd5972627534C1D5f3' as const;
export const BIBET_CHAIN = studionet;
export const BIBET_NETWORK = 'studionet' as const;
export const readClient = createClient({ chain: BIBET_CHAIN, account: createAccount() });

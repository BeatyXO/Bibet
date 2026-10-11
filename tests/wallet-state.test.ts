import assert from "node:assert/strict";
import { BIBET_CHAIN } from "../lib/config";
import { getInjectedWalletState } from "../lib/wallet";

const originalWindow = Object.getOwnPropertyDescriptor(globalThis, "window");
async function main() {
  try {
    const calls: string[] = [];
    Object.defineProperty(globalThis, "window", {
      configurable: true,
      value: {
        ethereum: {
          request: async ({ method }: { method: string }) => {
            calls.push(method);
            if (method === "eth_accounts") return ["0x1234567890abcdef"];
            if (method === "eth_chainId") return `0x${BIBET_CHAIN.id.toString(16)}`;
            throw new Error(`Unexpected wallet request: ${method}`);
          },
        },
      },
    });
    assert.deepEqual(await getInjectedWalletState(BIBET_CHAIN), {
      address: "0x1234567890abcdef",
      onExpectedChain: true,
    });
    assert.deepEqual(calls.sort(), ["eth_accounts", "eth_chainId"]);

    Object.defineProperty(globalThis, "window", {
      configurable: true,
      value: { ethereum: { request: async ({ method }: { method: string }) => method === "eth_accounts" ? [] : "0x1" } },
    });
    assert.deepEqual(await getInjectedWalletState(BIBET_CHAIN), { address: null, onExpectedChain: false });
  } finally {
    if (originalWindow) Object.defineProperty(globalThis, "window", originalWindow);
    else Reflect.deleteProperty(globalThis, "window");
  }
}

void main().then(() => console.log("Wallet startup restoration tests passed"));

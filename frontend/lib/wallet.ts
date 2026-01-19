export interface InjectedProvider {
  request: (args: { method: string; params?: unknown[] }) => Promise<unknown>;
  on?: (event: string, handler: (...args: any[]) => void) => void;
  removeListener?: (event: string, handler: (...args: any[]) => void) => void;
  isMetaMask?: boolean;
  isPhantom?: boolean;
  isCoinbaseWallet?: boolean;
  isBraveWallet?: boolean;
  isRabby?: boolean;
  isTrust?: boolean;
  isOKXWallet?: boolean;
  isTally?: boolean;
  providers?: InjectedProvider[];
}

export interface WalletOption {
  id: string;
  name: string;
  provider: InjectedProvider;
}

const STORAGE_KEY = "whistlex:preferred-provider";

function slugify(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}

function getProviderLabel(provider: InjectedProvider) {
  if (provider.isMetaMask) return "MetaMask";
  if (provider.isPhantom) return "Phantom";
  if (provider.isCoinbaseWallet) return "Coinbase Wallet";
  if (provider.isBraveWallet) return "Brave Wallet";
  if (provider.isRabby) return "Rabby";
  if (provider.isTrust) return "Trust Wallet";
  if (provider.isOKXWallet) return "OKX Wallet";
  if (provider.isTally) return "Tally";
  return "Injected Wallet";
}

function uniqueProviders(providers: InjectedProvider[]) {
  const seen = new Set<InjectedProvider>();
  const result: InjectedProvider[] = [];
  providers.forEach((provider) => {
    if (!provider || typeof provider.request !== "function") return;
    if (seen.has(provider)) return;
    seen.add(provider);
    result.push(provider);
  });
  return result;
}

export function listInjectedProviders(): WalletOption[] {
  if (typeof window === "undefined") return [];
  const anyWindow = window as any;
  const candidates: InjectedProvider[] = [];

  const ethereum = anyWindow.ethereum as InjectedProvider | undefined;
  if (ethereum?.providers?.length) {
    candidates.push(...ethereum.providers);
  } else if (ethereum) {
    candidates.push(ethereum);
  }

  const phantomEvm = anyWindow.phantom?.ethereum as InjectedProvider | undefined;
  if (phantomEvm) {
    candidates.push(phantomEvm);
  }

  return uniqueProviders(candidates).map((provider, index) => {
    const name = getProviderLabel(provider);
    return {
      id: `${slugify(name)}-${index}`,
      name,
      provider
    };
  });
}

export function getPreferredProviderId() {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(STORAGE_KEY);
}

export function setPreferredProviderId(value: string | null) {
  if (typeof window === "undefined") return;
  if (value) {
    window.localStorage.setItem(STORAGE_KEY, value);
  } else {
    window.localStorage.removeItem(STORAGE_KEY);
  }
}

export function setActiveProvider(provider: InjectedProvider | null, providerId?: string | null) {
  if (typeof window === "undefined") return;
  const anyWindow = window as any;
  anyWindow.__whistlexProvider = provider ?? null;
  if (providerId !== undefined) {
    setPreferredProviderId(providerId);
  }
}

export function getActiveProvider(): InjectedProvider | null {
  if (typeof window === "undefined") return null;
  const anyWindow = window as any;
  if (anyWindow.__whistlexProvider?.request) {
    return anyWindow.__whistlexProvider as InjectedProvider;
  }

  const providers = listInjectedProviders();
  const preferredId = getPreferredProviderId();
  if (preferredId) {
    const match = providers.find((option) => option.id === preferredId);
    if (match) {
      anyWindow.__whistlexProvider = match.provider;
      return match.provider;
    }
  }

  const fallback = (anyWindow.ethereum as InjectedProvider | undefined) ?? providers[0]?.provider ?? null;
  if (fallback) {
    anyWindow.__whistlexProvider = fallback;
  }
  return fallback;
}

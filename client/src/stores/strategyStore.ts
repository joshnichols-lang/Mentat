import { create } from 'zustand';

interface AevoMarket {
  instrument_id: string;
  instrument_name: string;
  instrument_type: 'OPTION' | 'PERPETUAL';
  option_type?: 'call' | 'put';
  underlying_asset: string;
  strike?: string;
  expiry?: string;
  mark_price: string;
  best_bid?: string;
  best_ask?: string;
  open_interest?: string;
  volume_24h?: string;
  index_price?: string;
  is_active: boolean;
  greeks?: {
    delta: string;
    gamma: string;
    theta: string;
    vega: string;
    rho: string;
    iv?: string;
  };
}

interface StrategyLeg {
  id: string;
  market: AevoMarket;
  action: 'buy' | 'sell'; // Whether we're buying or selling this option
  quantity: number;
}

interface StrategySessionState {
  // Selection state
  asset: string;
  selectedExpiry: string | null;
  selectedStrike: string | null;
  selectedOptionType: 'call' | 'put' | null;
  selectedMarket: AevoMarket | null;
  
  // Strategy composition
  strategyType: string | null; // e.g., "long-call", "butterfly", etc.
  legs: StrategyLeg[];
  
  // Live market data
  currentSpotPrice: number;
  
  // Actions
  setAsset: (asset: string) => void;
  setExpiry: (expiry: string) => void;
  selectMarket: (market: AevoMarket) => void;
  setStrategyType: (type: string) => void;
  addLeg: (leg: StrategyLeg) => void;
  removeLeg: (legId: string) => void;
  updateLeg: (legId: string, updates: Partial<StrategyLeg>) => void;
  clearLegs: () => void;
  resetStrategy: () => void;
  setCurrentSpotPrice: (price: number) => void;
}

export const useStrategyStore = create<StrategySessionState>((set) => ({
  // Initial state
  asset: 'ETH',
  selectedExpiry: null,
  selectedStrike: null,
  selectedOptionType: null,
  selectedMarket: null,
  strategyType: null,
  legs: [],
  currentSpotPrice: 0,
  
  // Actions
  setAsset: (asset) => set({ asset, selectedExpiry: null, selectedStrike: null, selectedMarket: null, legs: [] }),
  
  setExpiry: (expiry) => set({ selectedExpiry: expiry }),
  
  selectMarket: (market) => set({
    selectedMarket: market,
    selectedStrike: market.strike || null,
    selectedOptionType: market.option_type || null,
    selectedExpiry: market.expiry || null,
  }),
  
  setStrategyType: (type) => set({ strategyType: type }),
  
  addLeg: (leg) => set((state) => ({ legs: [...state.legs, leg] })),
  
  removeLeg: (legId) => set((state) => ({
    legs: state.legs.filter(leg => leg.id !== legId),
  })),
  
  updateLeg: (legId, updates) => set((state) => ({
    legs: state.legs.map(leg =>
      leg.id === legId ? { ...leg, ...updates } : leg
    ),
  })),
  
  clearLegs: () => set({ legs: [] }),
  
  resetStrategy: () => set({
    selectedStrike: null,
    selectedOptionType: null,
    selectedMarket: null,
    strategyType: null,
    legs: [],
  }),
  
  setCurrentSpotPrice: (price) => set({ currentSpotPrice: price }),
}));

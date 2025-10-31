import { getUserHyperliquidClient } from "./hyperliquid/client";
import { createOrderlyClient, type OrderlyClient } from "./orderly/client";
import { getPolymarketClient } from "./polymarket/client";
import { storage } from "./storage";

// Unified position interfaces
export interface UnifiedPerpPosition {
  exchange: "hyperliquid" | "orderly";
  symbol: string;
  side: "long" | "short";
  size: number;
  entryPrice: number;
  currentPrice: number;
  leverage: number;
  unrealizedPnl: number;
  pnlPercent: number;
  liquidationPrice: number | null;
  notionalValue: number; // size * currentPrice
  delta: number; // For perps, delta ≈ size (positive for long, negative for short)
}

export interface UnifiedOptionsPosition {
  exchange: "aevo";
  instrumentName: string;
  instrumentId: string;
  asset: string; // ETH, BTC, etc.
  optionType: "call" | "put";
  strike: number;
  expiry: Date;
  side: "long" | "short";
  size: number;
  entryPrice: number;
  currentPrice: number;
  unrealizedPnl: number;
  notionalValue: number;
  delta: number; // Options delta from Greeks
  gamma: number;
  theta: number;
  vega: number;
  impliedVolatility: number | null;
}

export interface UnifiedPredictionPosition {
  exchange: "polymarket";
  marketQuestion: string;
  marketId: string;
  assetId: string;
  outcome: string; // YES/NO or specific outcome
  size: number;
  entryPrice: number; // Probability at entry (0-1)
  currentPrice: number | null; // Current probability
  unrealizedPnl: number;
  notionalValue: number;
  exposure: number; // Dollar exposure
}

export interface PortfolioSummary {
  totalValue: number; // Total portfolio value across all accounts
  totalPnl: number; // Total unrealized P&L
  totalDelta: number; // Aggregate delta exposure across all instruments
  totalGamma: number; // Aggregate gamma for options
  totalTheta: number; // Aggregate theta (time decay)
  totalVega: number; // Aggregate vega (volatility exposure)
  assetExposure: {
    [asset: string]: {
      perpDelta: number; // Delta from perpetuals
      optionsDelta: number; // Delta from options
      totalDelta: number; // Combined delta
      notionalValue: number; // Total notional exposure
      predictionExposure: number; // Exposure from prediction markets
    };
  };
}

export interface UnifiedPortfolio {
  perpetuals: UnifiedPerpPosition[];
  options: UnifiedOptionsPosition[];
  predictions: UnifiedPredictionPosition[];
  summary: PortfolioSummary;
  lastUpdated: Date;
}

/**
 * Aggregate all positions across exchanges into a unified portfolio view
 */
export async function getUnifiedPortfolio(userId: string): Promise<UnifiedPortfolio> {
  console.log(`[Portfolio Aggregator] Fetching unified portfolio for user ${userId}`);
  
  const perpetuals: UnifiedPerpPosition[] = [];
  const options: UnifiedOptionsPosition[] = [];
  const predictions: UnifiedPredictionPosition[] = [];
  
  // Fetch Hyperliquid perpetuals
  try {
    const hlClient = await getUserHyperliquidClient(userId);
    const hlPositions = await hlClient.getPositions();
    
    for (const pos of hlPositions) {
      const size = parseFloat(pos.szi);
      if (Math.abs(size) < 0.001) continue; // Skip closed positions
      
      const entryPrice = parseFloat(pos.entryPx);
      const positionValue = parseFloat(pos.positionValue);
      const currentPrice = Math.abs(size) > 0 ? Math.abs(positionValue) / Math.abs(size) : entryPrice;
      const unrealizedPnl = parseFloat(pos.unrealizedPnl);
      const leverageObj = pos.leverage;
      const leverage = typeof leverageObj === 'object' && leverageObj && 'value' in leverageObj
        ? leverageObj.value
        : typeof leverageObj === 'string'
        ? parseFloat(leverageObj)
        : 1;
      const liquidationPrice = pos.liquidationPx ? parseFloat(pos.liquidationPx) : null;
      
      perpetuals.push({
        exchange: "hyperliquid",
        symbol: pos.coin,
        side: size > 0 ? "long" : "short",
        size: Math.abs(size),
        entryPrice,
        currentPrice,
        leverage,
        unrealizedPnl,
        pnlPercent: entryPrice > 0 ? (unrealizedPnl / (entryPrice * Math.abs(size))) * 100 : 0,
        liquidationPrice,
        notionalValue: Math.abs(positionValue),
        delta: size, // For perps, delta ≈ position size (positive = long, negative = short)
      });
    }
    
    console.log(`[Portfolio Aggregator] Found ${perpetuals.length} Hyperliquid positions`);
  } catch (error) {
    console.error("[Portfolio Aggregator] Failed to fetch Hyperliquid positions:", error);
    // Continue with other exchanges even if one fails
  }
  
  // Fetch Orderly perpetuals
  try {
    // Get Orderly API credentials
    const orderlyApiKey = await storage.getActiveApiKeyByProvider(userId, "exchange", "orderly");
    if (!orderlyApiKey) {
      console.log("[Portfolio Aggregator] No Orderly API key found for user");
      // Skip Orderly positions if no credentials
      throw new Error("No Orderly credentials");
    }
    
    // Decrypt credentials
    const { decryptCredential } = await import("./encryption");
    const apiKey = decryptCredential(
      orderlyApiKey.encryptedApiKey,
      orderlyApiKey.apiKeyIv,
      orderlyApiKey.encryptedDek,
      orderlyApiKey.dekIv
    );
    const apiSecret = orderlyApiKey.metadata && typeof orderlyApiKey.metadata === 'object' && 'apiSecret' in orderlyApiKey.metadata
      ? String((orderlyApiKey.metadata as any).apiSecret)
      : '';
    const accountId = orderlyApiKey.metadata && typeof orderlyApiKey.metadata === 'object' && 'accountId' in orderlyApiKey.metadata
      ? String((orderlyApiKey.metadata as any).accountId)
      : '';
    
    if (!apiSecret || !accountId) {
      throw new Error("Incomplete Orderly credentials");
    }
    
    const orderlyClient = createOrderlyClient({
      apiKey,
      apiSecret,
      accountId,
      testnet: false,
    });
    const orderlyPositions = await orderlyClient.getPositions();
    
    for (const pos of orderlyPositions) {
      const qty = parseFloat(pos.positionQty);
      if (Math.abs(qty) < 0.001) continue; // Skip closed positions
      
      const avgPrice = parseFloat(pos.averageOpenPrice);
      const markPrice = parseFloat(pos.markPrice);
      const unrealizedPnl = parseFloat(pos.unrealizedPnl);
      const leverage = parseFloat(pos.leverage || "1");
      const liquidationPrice = pos.liquidationPrice ? parseFloat(pos.liquidationPrice) : null;
      
      perpetuals.push({
        exchange: "orderly",
        symbol: pos.symbol,
        side: qty > 0 ? "long" : "short",
        size: Math.abs(qty),
        entryPrice: avgPrice,
        currentPrice: markPrice,
        leverage,
        unrealizedPnl,
        pnlPercent: avgPrice > 0 ? (unrealizedPnl / (avgPrice * Math.abs(qty))) * 100 : 0,
        liquidationPrice,
        notionalValue: Math.abs(qty) * markPrice,
        delta: qty, // Delta = position size
      });
    }
    
    console.log(`[Portfolio Aggregator] Found ${perpetuals.length - perpetuals.filter(p => p.exchange === "hyperliquid").length} Orderly positions`);
  } catch (error) {
    console.error("[Portfolio Aggregator] Failed to fetch Orderly positions:", error);
  }
  
  // Fetch Aevo options positions - try live API first, fall back to database
  let aevoLiveFailed = false;
  try {
    // Get Aevo API credentials
    const aevoApiKey = await storage.getActiveApiKeyByProvider(userId, "exchange", "aevo");
    if (!aevoApiKey) {
      console.log("[Portfolio Aggregator] No Aevo API key found, falling back to database");
      throw new Error("No Aevo credentials");
    }
    
    // Decrypt credentials
    const { decryptCredential } = await import("./encryption");
    const apiKey = decryptCredential(
      aevoApiKey.encryptedApiKey,
      aevoApiKey.apiKeyIv,
      aevoApiKey.encryptedDek,
      aevoApiKey.dekIv
    );
    const apiSecret = aevoApiKey.metadata && typeof aevoApiKey.metadata === 'object' && 'apiSecret' in aevoApiKey.metadata
      ? String((aevoApiKey.metadata as any).apiSecret)
      : '';
    const signingKey = aevoApiKey.metadata && typeof aevoApiKey.metadata === 'object' && 'signingKey' in aevoApiKey.metadata
      ? String((aevoApiKey.metadata as any).signingKey)
      : '';
    
    if (!apiSecret || !signingKey) {
      throw new Error("Incomplete Aevo credentials");
    }
    
    // Create Aevo client
    const { AevoClient } = await import("./aevo/client");
    const aevoClient = new AevoClient({
      apiKey,
      apiSecret,
      signingKey,
      testnet: false,
    });
    
    // Fetch live portfolio from Aevo
    const aevoPortfolio = await aevoClient.getPortfolio();
    
    for (const pos of aevoPortfolio.positions) {
      if (pos.instrument_type !== "OPTION") continue; // Only process options
      
      const amount = parseFloat(pos.amount);
      if (Math.abs(amount) < 0.001) continue; // Skip closed positions
      
      const entryPrice = parseFloat(pos.entry_price);
      const markPrice = parseFloat(pos.mark_price);
      const unrealizedPnl = parseFloat(pos.unrealized_pnl);
      
      // Parse Greeks
      const delta = pos.greeks?.delta ? parseFloat(pos.greeks.delta) : 0;
      const gamma = pos.greeks?.gamma ? parseFloat(pos.greeks.gamma) : 0;
      const theta = pos.greeks?.theta ? parseFloat(pos.greeks.theta) : 0;
      const vega = pos.greeks?.vega ? parseFloat(pos.greeks.vega) : 0;
      const iv = pos.greeks?.iv ? parseFloat(pos.greeks.iv) : null;
      
      // Parse instrument name (e.g., "ETH-31MAR25-2000-C" -> asset: ETH, expiry: Mar 31 2025, strike: 2000, type: call)
      const nameParts = pos.instrument_name.split('-');
      const asset = nameParts[0] || "UNKNOWN";
      const expiryStr = nameParts.length >= 2 ? nameParts[1] : "";
      const strikeStr = nameParts.length >= 3 ? nameParts[nameParts.length - 2] : "0";
      const optionTypeChar = nameParts.length >= 4 ? nameParts[nameParts.length - 1] : "C";
      const strike = parseFloat(strikeStr);
      const optionType = optionTypeChar.toUpperCase() === "C" ? "call" : "put";
      
      // Parse expiry date from format "31MAR25" -> March 31, 2025
      let expiry = new Date();
      if (expiryStr && expiryStr.length >= 5) {
        const day = parseInt(expiryStr.substring(0, 2));
        const monthStr = expiryStr.substring(2, 5).toUpperCase();
        const year = 2000 + parseInt(expiryStr.substring(5));
        
        const monthMap: { [key: string]: number } = {
          JAN: 0, FEB: 1, MAR: 2, APR: 3, MAY: 4, JUN: 5,
          JUL: 6, AUG: 7, SEP: 8, OCT: 9, NOV: 10, DEC: 11
        };
        const month = monthMap[monthStr] ?? 0;
        expiry = new Date(year, month, day);
      }
      
      // Adjust delta based on position side
      const adjustedDelta = pos.side === "long" ? delta * amount : -delta * amount;
      
      options.push({
        exchange: "aevo",
        instrumentName: pos.instrument_name,
        instrumentId: pos.instrument_id,
        asset,
        optionType,
        strike,
        expiry,
        side: pos.side,
        size: Math.abs(amount),
        entryPrice,
        currentPrice: markPrice,
        unrealizedPnl,
        notionalValue: markPrice * Math.abs(amount),
        delta: adjustedDelta,
        gamma,
        theta,
        vega,
        impliedVolatility: iv,
      });
    }
    
    console.log(`[Portfolio Aggregator] Found ${options.length} Aevo options positions (live API)`);
  } catch (error) {
    console.error("[Portfolio Aggregator] Failed to fetch live Aevo positions, trying database fallback:", error);
    aevoLiveFailed = true;
    
    // Fall back to database positions
    try {
      const dbOptions = await storage.getOptionsPositions(userId);
      
      for (const pos of dbOptions) {
        if (pos.status !== "open") continue;
        
        const size = parseFloat(pos.size);
        const entryPrice = parseFloat(pos.entryPrice);
        const currentPrice = parseFloat(pos.currentPrice);
        const unrealizedPnl = parseFloat(pos.unrealizedPnl || "0");
        const delta = pos.delta ? parseFloat(pos.delta) : 0;
        const gamma = pos.gamma ? parseFloat(pos.gamma) : 0;
        const theta = pos.theta ? parseFloat(pos.theta) : 0;
        const vega = pos.vega ? parseFloat(pos.vega) : 0;
        const iv = pos.impliedVolatility ? parseFloat(pos.impliedVolatility) : null;
        
        const adjustedDelta = pos.side === "long" ? delta * size : -delta * size;
        const optionType = pos.optionType === "call" || pos.optionType === "put" ? pos.optionType : "call";
        const side = pos.side === "long" || pos.side === "short" ? pos.side : "long";
        
        options.push({
          exchange: "aevo",
          instrumentName: pos.instrumentName,
          instrumentId: pos.instrumentId,
          asset: pos.asset,
          optionType,
          strike: parseFloat(pos.strike),
          expiry: pos.expiry,
          side,
          size,
          entryPrice,
          currentPrice,
          unrealizedPnl,
          notionalValue: currentPrice * size,
          delta: adjustedDelta,
          gamma,
          theta,
          vega,
          impliedVolatility: iv,
        });
      }
      
      console.log(`[Portfolio Aggregator] Found ${options.length} Aevo options positions (database fallback)`);
    } catch (dbError) {
      console.error("[Portfolio Aggregator] Failed to fetch Aevo options from database:", dbError);
    }
  }
  
  // Fetch Polymarket positions
  try {
    const pmClient = await getPolymarketClient(userId, storage);
    const pmPositions = await pmClient.getPositions();
    
    for (const pos of pmPositions) {
      const size = parseFloat(pos.size || "0");
      if (size < 0.01) continue; // Skip tiny positions
      
      const entryPrice = parseFloat(pos.averagePrice || pos.entryPrice || "0");
      const currentPrice = pos.price ? parseFloat(pos.price) : entryPrice;
      const unrealizedPnl = parseFloat(pos.unrealizedPnl || "0");
      const notionalValue = size * currentPrice;
      
      predictions.push({
        exchange: "polymarket",
        marketQuestion: pos.marketQuestion || pos.market_id || "Unknown Market",
        marketId: pos.market_id,
        assetId: pos.asset_id,
        outcome: pos.side || "YES",
        size,
        entryPrice,
        currentPrice,
        unrealizedPnl,
        notionalValue,
        exposure: notionalValue, // Dollar exposure
      });
    }
    
    console.log(`[Portfolio Aggregator] Found ${predictions.length} Polymarket positions`);
  } catch (error) {
    console.error("[Portfolio Aggregator] Failed to fetch Polymarket positions:", error);
  }
  
  // Calculate portfolio summary
  const summary = calculatePortfolioSummary(perpetuals, options, predictions);
  
  return {
    perpetuals,
    options,
    predictions,
    summary,
    lastUpdated: new Date(),
  };
}

/**
 * Calculate aggregate portfolio metrics
 */
function calculatePortfolioSummary(
  perpetuals: UnifiedPerpPosition[],
  options: UnifiedOptionsPosition[],
  predictions: UnifiedPredictionPosition[]
): PortfolioSummary {
  let totalValue = 0;
  let totalPnl = 0;
  let totalDelta = 0;
  let totalGamma = 0;
  let totalTheta = 0;
  let totalVega = 0;
  
  const assetExposure: {
    [asset: string]: {
      perpDelta: number;
      optionsDelta: number;
      totalDelta: number;
      notionalValue: number;
      predictionExposure: number;
    };
  } = {};
  
  // Aggregate perpetuals
  for (const perp of perpetuals) {
    totalValue += perp.notionalValue;
    totalPnl += perp.unrealizedPnl;
    totalDelta += perp.delta;
    
    // Extract base asset (e.g., "ETH-PERP" → "ETH")
    const baseAsset = perp.symbol.replace(/-PERP$|_PERP$/, "").split("-")[0];
    
    if (!assetExposure[baseAsset]) {
      assetExposure[baseAsset] = {
        perpDelta: 0,
        optionsDelta: 0,
        totalDelta: 0,
        notionalValue: 0,
        predictionExposure: 0,
      };
    }
    
    assetExposure[baseAsset].perpDelta += perp.delta;
    assetExposure[baseAsset].notionalValue += perp.notionalValue;
  }
  
  // Aggregate options
  for (const opt of options) {
    totalValue += opt.notionalValue;
    totalPnl += opt.unrealizedPnl;
    totalDelta += opt.delta;
    totalGamma += opt.gamma * opt.size;
    totalTheta += opt.theta * opt.size;
    totalVega += opt.vega * opt.size;
    
    if (!assetExposure[opt.asset]) {
      assetExposure[opt.asset] = {
        perpDelta: 0,
        optionsDelta: 0,
        totalDelta: 0,
        notionalValue: 0,
        predictionExposure: 0,
      };
    }
    
    assetExposure[opt.asset].optionsDelta += opt.delta;
    assetExposure[opt.asset].notionalValue += opt.notionalValue;
  }
  
  // Aggregate prediction markets
  for (const pred of predictions) {
    totalValue += pred.notionalValue;
    totalPnl += pred.unrealizedPnl;
    
    // Try to extract asset from market question (e.g., "Will ETH..." → "ETH")
    const assetMatch = pred.marketQuestion.match(/\b(BTC|ETH|SOL|MATIC|AVAX)\b/i);
    if (assetMatch) {
      const asset = assetMatch[1].toUpperCase();
      if (!assetExposure[asset]) {
        assetExposure[asset] = {
          perpDelta: 0,
          optionsDelta: 0,
          totalDelta: 0,
          notionalValue: 0,
          predictionExposure: 0,
        };
      }
      assetExposure[asset].predictionExposure += pred.exposure;
    }
  }
  
  // Calculate total delta for each asset
  for (const asset in assetExposure) {
    assetExposure[asset].totalDelta = 
      assetExposure[asset].perpDelta + assetExposure[asset].optionsDelta;
  }
  
  return {
    totalValue,
    totalPnl,
    totalDelta,
    totalGamma,
    totalTheta,
    totalVega,
    assetExposure,
  };
}

/**
 * Format portfolio for AI context
 */
export function formatPortfolioForAI(portfolio: UnifiedPortfolio): string {
  const { perpetuals, options, predictions, summary } = portfolio;
  
  let context = `\n=== MULTI-INSTRUMENT PORTFOLIO ANALYSIS ===\n\n`;
  
  // Summary metrics
  context += `PORTFOLIO SUMMARY:\n`;
  context += `- Total Value: $${summary.totalValue.toFixed(2)}\n`;
  context += `- Total P&L: $${summary.totalPnl.toFixed(2)} (${summary.totalValue > 0 ? ((summary.totalPnl / summary.totalValue) * 100).toFixed(2) : 0}%)\n`;
  context += `- Total Delta Exposure: ${summary.totalDelta.toFixed(2)}\n`;
  if (Math.abs(summary.totalGamma) > 0.001) {
    context += `- Total Gamma: ${summary.totalGamma.toFixed(4)}\n`;
  }
  if (Math.abs(summary.totalTheta) > 0.001) {
    context += `- Total Theta (daily decay): $${summary.totalTheta.toFixed(2)}\n`;
  }
  if (Math.abs(summary.totalVega) > 0.001) {
    context += `- Total Vega (1% IV change): $${summary.totalVega.toFixed(2)}\n`;
  }
  
  // Asset-level exposure
  if (Object.keys(summary.assetExposure).length > 0) {
    context += `\nASSET EXPOSURE BREAKDOWN:\n`;
    for (const [asset, exposure] of Object.entries(summary.assetExposure)) {
      context += `${asset}:\n`;
      if (Math.abs(exposure.perpDelta) > 0.001) {
        context += `  - Perpetuals Delta: ${exposure.perpDelta > 0 ? '+' : ''}${exposure.perpDelta.toFixed(2)}\n`;
      }
      if (Math.abs(exposure.optionsDelta) > 0.001) {
        context += `  - Options Delta: ${exposure.optionsDelta > 0 ? '+' : ''}${exposure.optionsDelta.toFixed(2)}\n`;
      }
      if (Math.abs(exposure.totalDelta) > 0.001) {
        context += `  - Total Delta: ${exposure.totalDelta > 0 ? '+' : ''}${exposure.totalDelta.toFixed(2)}\n`;
      }
      if (Math.abs(exposure.predictionExposure) > 0.01) {
        context += `  - Prediction Market Exposure: $${exposure.predictionExposure.toFixed(2)}\n`;
      }
      context += `  - Notional Value: $${exposure.notionalValue.toFixed(2)}\n`;
    }
  }
  
  // Perpetuals positions
  if (perpetuals.length > 0) {
    context += `\nPERPETUAL FUTURES (${perpetuals.length} positions):\n`;
    for (const perp of perpetuals) {
      context += `- ${perp.symbol} (${perp.exchange}): ${perp.side} ${perp.size} @ $${perp.currentPrice.toFixed(2)} (${perp.leverage}x leverage)\n`;
      context += `  Entry: $${perp.entryPrice.toFixed(2)} | P&L: $${perp.unrealizedPnl.toFixed(2)} (${perp.pnlPercent.toFixed(2)}%) | Delta: ${perp.delta > 0 ? '+' : ''}${perp.delta.toFixed(2)}\n`;
      if (perp.liquidationPrice) {
        context += `  Liquidation: $${perp.liquidationPrice.toFixed(2)}\n`;
      }
    }
  }
  
  // Options positions
  if (options.length > 0) {
    context += `\nOPTIONS (${options.length} positions):\n`;
    for (const opt of options) {
      context += `- ${opt.instrumentName} (${opt.exchange}): ${opt.side} ${opt.size} ${opt.optionType}s\n`;
      context += `  Strike: $${opt.strike.toFixed(2)} | Expiry: ${opt.expiry.toISOString().split('T')[0]}\n`;
      context += `  P&L: $${opt.unrealizedPnl.toFixed(2)} | Delta: ${opt.delta > 0 ? '+' : ''}${opt.delta.toFixed(4)}\n`;
      if (opt.impliedVolatility) {
        context += `  IV: ${(opt.impliedVolatility * 100).toFixed(1)}% | Theta: $${opt.theta.toFixed(2)}/day | Vega: $${opt.vega.toFixed(2)}\n`;
      }
    }
  }
  
  // Prediction markets
  if (predictions.length > 0) {
    context += `\nPREDICTION MARKETS (${predictions.length} positions):\n`;
    for (const pred of predictions) {
      context += `- "${pred.marketQuestion}" (${pred.exchange})\n`;
      context += `  Outcome: ${pred.outcome} | Size: ${pred.size} shares @ $${pred.entryPrice.toFixed(2)}\n`;
      if (pred.currentPrice) {
        context += `  Current: $${pred.currentPrice.toFixed(2)} | P&L: $${pred.unrealizedPnl.toFixed(2)}\n`;
      }
      context += `  Exposure: $${pred.exposure.toFixed(2)}\n`;
    }
  }
  
  return context;
}

'use client';

import { useState, useEffect } from 'react';
import { coinGeckoApi } from '@/lib/coinGeckoApi';
import { forecastingApi, ForecastData } from '@/lib/forecastingApi';

interface TokenOverview {
  coinId: string;
  symbol: string;
  name: string;
  price: number;
  change24h: number;
  marketCap: string;
  icon: string;
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Unexpected error';
}

const TOKEN_BASE: Omit<TokenOverview, 'price' | 'change24h' | 'marketCap'>[] = [
  { coinId: 'bitcoin', symbol: 'BTC_USDT', name: 'Bitcoin', icon: '₿' },
  { coinId: 'ethereum', symbol: 'ETH_USDT', name: 'Ethereum', icon: 'Ξ' },
  { coinId: 'binancecoin', symbol: 'BNB_USDT', name: 'BNB', icon: '🔶' },
  { coinId: 'solana', symbol: 'SOL_USDT', name: 'Solana', icon: '◎' },
  { coinId: 'cardano', symbol: 'ADA_USDT', name: 'Cardano', icon: '₳' },
  { coinId: 'ripple', symbol: 'XRP_USDT', name: 'XRP', icon: '✕' },
  { coinId: 'polkadot', symbol: 'DOT_USDT', name: 'Polkadot', icon: '●' },
  { coinId: 'polygon', symbol: 'MATIC_USDT', name: 'Polygon', icon: '⬡' },
  { coinId: 'chainlink', symbol: 'LINK_USDT', name: 'Chainlink', icon: '🔗' },
  { coinId: 'uniswap', symbol: 'UNI_USDT', name: 'Uniswap', icon: '🦄' },
  { coinId: 'avalanche-2', symbol: 'AVAX_USDT', name: 'Avalanche', icon: '🔺' },
  { coinId: 'tron', symbol: 'TRX_USDT', name: 'TRON', icon: '◬' },
];

export default function ForecastingPage() {
  const [selectedSymbol, setSelectedSymbol] = useState('');
  const [forecast, setForecast] = useState<ForecastData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [investmentAmount, setInvestmentAmount] = useState(1000);
  const [tokenOverviews, setTokenOverviews] = useState<TokenOverview[]>([]);
  const [activeTab, setActiveTab] = useState<'all' | 'gainers' | 'losers'>('all');

  useEffect(() => { loadSymbols(); loadTokenOverviews(); }, []);
  useEffect(() => { if (selectedSymbol) loadForecast(selectedSymbol); }, [selectedSymbol]);

  const loadTokenOverviews = async () => {
    const tokenData: TokenOverview[] = TOKEN_BASE.map(t => ({ ...t, price: 0, change24h: 0, marketCap: '' }));
    try {
      const data = await coinGeckoApi.getTokenPrices(TOKEN_BASE.map((token) => token.coinId));
      const marketDataById = new Map(data.map((coin) => [coin.id, coin]));

      tokenData.forEach((token) => {
        const marketData = marketDataById.get(token.coinId);
        if (!marketData) {
          return;
        }

        token.price = marketData.current_price;
        token.change24h = marketData.price_change_percentage_24h || 0;
        token.marketCap = `$${(marketData.market_cap / 1e9).toFixed(2)}B`;
      });
    } catch (e) { console.error('Error fetching prices:', e); }
    setTokenOverviews(tokenData);
  };

  const loadSymbols = async () => {
    try {
      const data = await forecastingApi.getSupportedSymbols();
      if (data.length > 0) setSelectedSymbol(data[0]);
    } catch (error: unknown) { setError(getErrorMessage(error)); }
  };

  const loadForecast = async (symbol: string) => {
    setLoading(true); setError(null);
    try { setForecast(await forecastingApi.getForecast(symbol)); }
    catch (error: unknown) { setError(getErrorMessage(error)); }
    finally { setLoading(false); }
  };

  const getRiskColor = (cat: string) => {
    if (cat.includes('High')) return 'text-[#FF4C4C]';
    if (cat.includes('Medium')) return 'text-[#F59E0B]';
    return 'text-[#00FFB2]';
  };
  const getTrendIcon = (t: string) => t === 'bullish' ? '📈' : t === 'bearish' ? '📉' : '➡️';
  const calcPL = (cur: number, pred: number) => {
    const change = ((pred - cur) / cur) * 100;
    return { isProfit: change > 0, percentage: Math.abs(change), amount: Math.abs((investmentAmount * change) / 100), change };
  };
  const getRec = (trend: string, conf: number, risk: number) => {
    if (risk > 70) return { text: '⚠️ High Risk — consider waiting', color: 'text-[#FF4C4C]' };
    if (trend === 'bullish' && conf > 60) return { text: '✅ Good time to invest', color: 'text-[#00FFB2]' };
    if (trend === 'bearish' && conf > 60) return { text: '⚠️ Consider selling or waiting', color: 'text-[#F59E0B]' };
    return { text: '⏸️ Market uncertain — be cautious', color: 'text-[#F59E0B]' };
  };

  const filteredTokens = tokenOverviews.filter(t =>
    activeTab === 'gainers' ? t.change24h > 0 :
      activeTab === 'losers' ? t.change24h < 0 :
        true
  ).sort((a, b) =>
    activeTab === 'gainers' ? b.change24h - a.change24h :
      activeTab === 'losers' ? a.change24h - b.change24h :
        0
  );

  const TABS: { key: 'all' | 'gainers' | 'losers'; label: string; activeClass: string }[] = [
    { key: 'all', label: 'All', activeClass: 'bg-[#00FFB2]/10 text-[#00FFB2] border-[#00FFB2]/30' },
    { key: 'gainers', label: 'Gainers 📈', activeClass: 'bg-[#00FFB2]/10 text-[#00FFB2] border-[#00FFB2]/30' },
    { key: 'losers', label: 'Losers 📉', activeClass: 'bg-[#FF4C4C]/10 text-[#FF4C4C] border-[#FF4C4C]/30' },
  ];

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-[#F5F5F5]">AI Forecasting & Risk Analysis</h1>
        <p className="text-sm text-[#D5D5D5]/60 mt-1">AI-powered predictions for smarter investment decisions</p>
      </div>

      {/* ── Token Selection ─────────────────────────────────────────────── */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-semibold text-[#F5F5F5]">Select Token for Forecast</h2>
          <div className="flex gap-2">
            {TABS.map(t => (
              <button
                key={t.key}
                onClick={() => setActiveTab(t.key)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${activeTab === t.key
                    ? t.activeClass
                    : 'bg-white/[0.03] border-white/10 text-[#D5D5D5]/60 hover:text-[#D5D5D5]'
                  }`}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-3">
          {filteredTokens.map((token) => (
            <button
              key={token.symbol}
              onClick={() => setSelectedSymbol(token.symbol)}
              className={`p-4 rounded-xl border text-left transition-all ${selectedSymbol === token.symbol
                  ? 'border-[#00FFB2]/50 bg-[#00FFB2]/5 shadow-[0_0_20px_rgba(0,255,178,0.1)]'
                  : 'border-white/10 bg-white/[0.03] hover:border-white/20 hover:bg-white/[0.06]'
                }`}
            >
              <div className="flex items-center gap-2 mb-2">
                <span className="text-xl">{token.icon}</span>
                <div>
                  <p className="text-xs font-bold text-[#F5F5F5] leading-tight">{token.name}</p>
                  <p className="text-[10px] text-[#D5D5D5]/40">{token.symbol.replace('_', '/')}</p>
                </div>
              </div>
              <p className="text-sm font-bold text-[#F5F5F5]">${token.price.toLocaleString()}</p>
              <p className={`text-xs font-semibold mt-0.5 ${token.change24h >= 0 ? 'text-[#00FFB2]' : 'text-[#FF4C4C]'}`}>
                {token.change24h >= 0 ? '+' : ''}{token.change24h.toFixed(2)}%
              </p>
              {token.marketCap && <p className="text-[10px] text-[#D5D5D5]/40 mt-1">{token.marketCap}</p>}
            </button>
          ))}
        </div>
      </div>

      {/* Investment Amount */}
      {selectedSymbol && (
        <div className="bg-white/[0.03] border border-white/10 rounded-2xl p-6">
          <label className="block text-xs font-medium text-[#D5D5D5]/60 uppercase tracking-wider mb-2">
            Investment Amount (USD)
          </label>
          <input
            type="number"
            value={investmentAmount}
            onChange={(e) => setInvestmentAmount(Number(e.target.value))}
            min="1"
            step="100"
            className="input-dark w-48 text-sm"
          />
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div className="flex flex-col items-center gap-4 py-16">
          <div className="w-10 h-10 border-2 border-[#00FFB2] border-t-transparent rounded-full animate-spin" />
          <p className="text-[#D5D5D5]/60 text-sm">Generating AI forecast…</p>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="bg-[#FF4C4C]/10 border border-[#FF4C4C]/30 rounded-xl p-4">
          <p className="text-[#FF4C4C] text-sm">{error}</p>
          <button onClick={() => loadForecast(selectedSymbol)} className="mt-2 text-xs text-[#FF4C4C]/70 underline">
            Retry
          </button>
        </div>
      )}

      {/* Forecast Display */}
      {forecast && !loading && (
        <div className="space-y-6">
          {/* Quick Summary */}
          <div className="bg-gradient-to-r from-[#00FFB2]/10 to-[#00CA8D]/5 border border-[#00FFB2]/20 rounded-2xl p-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-xl font-bold text-[#F5F5F5]">{selectedSymbol.replace('_', '/')}</h2>
                <p className="text-[#D5D5D5]/60 text-sm mt-1">Current Price: ${forecast.currentPrice.toLocaleString()}</p>
              </div>
              {(() => {
                const rec = getRec(
                  forecast.forecasts[1]?.trend || 'neutral',
                  forecast.forecasts[1]?.confidence || 0,
                  forecast.riskAnalysis.riskScore
                );
                return (
                  <p className={`text-sm font-semibold bg-white/5 border border-white/10 px-4 py-2 rounded-xl ${rec.color}`}>
                    {rec.text}
                  </p>
                );
              })()}
            </div>
          </div>

          {/* P&L Predictions */}
          <div>
            <h2 className="text-lg font-bold text-[#F5F5F5] mb-2">💰 Profit/Loss Predictions</h2>
            <p className="text-sm text-[#D5D5D5]/60 mb-4">
              If you invest ${investmentAmount.toLocaleString()} now, here&apos;s what you could expect:
            </p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {forecast.forecasts.map((f) => {
                const pl = calcPL(forecast.currentPrice, f.predictedPrice.mid);
                const HORIZON_LABELS: Record<string, string> = { '24h': '1 Day', '7d': '1 Week', '30d': '1 Month' };
                const glowColor = pl.isProfit ? 'border-[#00FFB2]/30 bg-[#00FFB2]/5' : 'border-[#FF4C4C]/30 bg-[#FF4C4C]/5';
                return (
                  <div key={f.horizon} className={`rounded-2xl border p-6 ${glowColor}`}>
                    <div className="flex justify-between items-center mb-4">
                      <h3 className="font-semibold text-[#F5F5F5]">{HORIZON_LABELS[f.horizon]}</h3>
                      <span className="text-xl">{getTrendIcon(f.trend)}</span>
                    </div>
                    {/* P&L badge */}
                    <div className={`text-center py-4 rounded-xl mb-4 ${pl.isProfit ? 'bg-[#00FFB2]/10' : 'bg-[#FF4C4C]/10'}`}>
                      <p className="text-xs text-[#D5D5D5]/60 mb-1">Expected {pl.isProfit ? 'Profit' : 'Loss'}</p>
                      <p className={`text-2xl font-bold ${pl.isProfit ? 'text-[#00FFB2]' : 'text-[#FF4C4C]'}`}>
                        {pl.isProfit ? '+' : '-'}${pl.amount.toFixed(2)}
                      </p>
                      <p className={`text-sm font-semibold ${pl.isProfit ? 'text-[#00FFB2]' : 'text-[#FF4C4C]'}`}>
                        {pl.isProfit ? '+' : '-'}{pl.percentage.toFixed(2)}%
                      </p>
                    </div>
                    {/* Price range */}
                    <div className="space-y-2 mb-4">
                      {[
                        { label: 'Best Case:', value: f.predictedPrice.high, color: 'text-[#00FFB2]' },
                        { label: 'Expected:', value: f.predictedPrice.mid, color: 'text-[#F5F5F5]' },
                        { label: 'Worst Case:', value: f.predictedPrice.low, color: 'text-[#FF4C4C]' },
                      ].map(({ label, value, color }) => (
                        <div key={label} className="flex justify-between text-sm">
                          <span className="text-[#D5D5D5]/60">{label}</span>
                          <span className={`font-semibold ${color}`}>${value.toFixed(2)}</span>
                        </div>
                      ))}
                    </div>
                    {/* Confidence */}
                    <div className="pt-3 border-t border-white/5">
                      <div className="flex justify-between text-xs mb-1">
                        <span className="text-[#D5D5D5]/60">Confidence</span>
                        <span className="font-semibold text-[#F5F5F5]">{f.confidence.toFixed(0)}%</span>
                      </div>
                      <div className="w-full bg-white/10 rounded-full h-1.5">
                        <div
                          className={`h-1.5 rounded-full ${f.confidence > 70 ? 'bg-[#00FFB2]' : f.confidence > 50 ? 'bg-[#F59E0B]' : 'bg-[#FF4C4C]'}`}
                          style={{ width: `${f.confidence}%` }}
                        />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Risk Analysis */}
          <div className="bg-white/[0.03] border border-white/10 rounded-2xl p-6">
            <h2 className="text-lg font-bold text-[#F5F5F5] mb-5">🛡️ Risk Analysis</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
              {[
                {
                  label: 'Risk Level',
                  main: `${forecast.riskAnalysis.riskScore.toFixed(0)}/100`,
                  sub: forecast.riskAnalysis.riskCategory,
                  color: getRiskColor(forecast.riskAnalysis.riskCategory),
                  note: forecast.riskAnalysis.riskScore < 40 ? 'Relatively safe' : forecast.riskAnalysis.riskScore < 70 ? 'Moderate — be cautious' : 'High risk',
                },
                {
                  label: 'Price Volatility',
                  main: `${forecast.riskAnalysis.volatility.toFixed(1)}%`,
                  sub: forecast.riskAnalysis.volatility < 30 ? 'Stable' : forecast.riskAnalysis.volatility < 60 ? 'Moderate Swings' : 'Very Volatile',
                  color: 'text-[#F5F5F5]',
                  note: 'How much price moves',
                },
                {
                  label: 'Market Sentiment',
                  main: forecast.riskAnalysis.sentiment,
                  sub: forecast.riskAnalysis.sentiment === 'bullish' ? '📈 Positive Outlook' : forecast.riskAnalysis.sentiment === 'bearish' ? '📉 Negative Outlook' : '➡️ Neutral Outlook',
                  color: 'text-[#F5F5F5] capitalize',
                  note: 'Overall market mood',
                },
              ].map(({ label, main, sub, color, note }) => (
                <div key={label} className="bg-white/[0.03] border border-white/5 rounded-xl p-5 text-center">
                  <p className="text-xs text-[#D5D5D5]/50 mb-2 uppercase tracking-wider">{label}</p>
                  <div className={`text-2xl font-bold mb-1 ${color}`}>{main}</div>
                  <p className={`text-sm font-medium text-[#D5D5D5] mb-1`}>{sub}</p>
                  <p className="text-xs text-[#D5D5D5]/40">{note}</p>
                </div>
              ))}
            </div>

            {/* Recommendations */}
            {forecast.riskAnalysis.recommendations.length > 0 && (
              <div className="bg-[#60A5FA]/5 border border-[#60A5FA]/20 rounded-xl p-4">
                <h3 className="text-sm font-semibold text-[#F5F5F5] mb-3 flex items-center gap-2">
                  💡 What This Means For You
                </h3>
                <ul className="space-y-2">
                  {forecast.riskAnalysis.recommendations.map((rec, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm text-[#D5D5D5]/80">
                      <span className="text-[#60A5FA] mt-0.5 shrink-0">•</span>
                      {rec}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          {/* Disclaimer */}
          <div className="bg-[#F59E0B]/5 border border-[#F59E0B]/20 rounded-xl p-4">
            <h3 className="text-sm font-semibold text-[#F5F5F5] mb-2 flex items-center gap-2">⚠️ Important Disclaimer</h3>
            <p className="text-xs text-[#D5D5D5]/70 leading-relaxed">
              These predictions are based on AI analysis and historical data. Cryptocurrency markets are highly volatile
              and unpredictable. Never invest more than you can afford to lose. This is not financial advice — always
              do your own research and consider consulting with a financial advisor.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

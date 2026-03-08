type MarketChip = {
  symbol: string;
  metric: string;
  accent: 'green' | 'blue' | 'neutral';
};

const tickerRows: MarketChip[][] = [
  [
    { symbol: 'BTC', metric: '$67.2K  +2.4%', accent: 'green' },
    { symbol: 'ETH', metric: '$3.4K  +1.8%', accent: 'blue' },
    { symbol: 'SOL', metric: '$182  +4.1%', accent: 'green' },
    { symbol: 'MATIC', metric: 'Flow  12.8M', accent: 'neutral' },
    { symbol: 'AVAX', metric: '$54.1  +3.2%', accent: 'green' },
    { symbol: 'ARB', metric: 'AI signal  0.81', accent: 'blue' },
  ],
  [
    { symbol: 'Volume', metric: '$124B  24H', accent: 'blue' },
    { symbol: 'Dominance', metric: 'BTC  52.7%', accent: 'neutral' },
    { symbol: 'Stables', metric: '$156B', accent: 'green' },
    { symbol: 'Funding', metric: '+0.012%', accent: 'blue' },
    { symbol: 'Momentum', metric: 'Risk  LOW', accent: 'green' },
    { symbol: 'ETH/BTC', metric: '0.051  +0.6%', accent: 'neutral' },
  ],
];

const floatingStats = [
  { label: 'On-Chain Flow', value: '$4.8B', position: 'left-[7%] top-[20%]', delay: '0s' },
  { label: 'Market Pulse', value: 'Bullish', position: 'right-[8%] top-[24%]', delay: '-3s' },
  { label: 'Live Coverage', value: '3 Chains + 1 Exchange', position: 'left-[12%] bottom-[18%]', delay: '-1.5s' },
];

function ChipColor({ accent }: { accent: MarketChip['accent'] }) {
  if (accent === 'green') {
    return <span className="h-2 w-2 rounded-full bg-[#00FFB2] shadow-[0_0_12px_rgba(0,255,178,0.7)]" />;
  }

  if (accent === 'blue') {
    return <span className="h-2 w-2 rounded-full bg-[#79A6FF] shadow-[0_0_12px_rgba(121,166,255,0.6)]" />;
  }

  return <span className="h-2 w-2 rounded-full bg-white/40" />;
}

function TickerLane({
  items,
  reverse = false,
  className,
}: {
  items: MarketChip[];
  reverse?: boolean;
  className: string;
}) {
  const repeatedItems = [...items, ...items];

  return (
    <div
      className={`absolute left-[-10%] w-[120%] overflow-hidden ${className}`}
      style={{
        maskImage: 'linear-gradient(90deg, transparent, rgba(0,0,0,1) 12%, rgba(0,0,0,1) 88%, transparent)',
      }}
    >
      <div className={`hero-ticker flex w-max gap-3 ${reverse ? 'hero-ticker-reverse' : ''}`}>
        {repeatedItems.map((item, index) => (
          <div
            key={`${item.symbol}-${item.metric}-${index}`}
            className="flex items-center gap-3 rounded-full border border-white/8 bg-[#090A10]/54 px-4 py-2 backdrop-blur-sm"
          >
            <ChipColor accent={item.accent} />
            <span className="text-[11px] font-semibold uppercase tracking-[0.22em] text-white/80">
              {item.symbol}
            </span>
            <span className="text-xs text-[#D5D5D5]/75">{item.metric}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function CryptoMotionBackground() {
  return (
    <div aria-hidden="true" className="pointer-events-none absolute inset-0 z-0 overflow-hidden opacity-[0.48]">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_36%,rgba(0,255,178,0.07),transparent_22%),radial-gradient(circle_at_78%_16%,rgba(121,166,255,0.045),transparent_20%),linear-gradient(180deg,rgba(8,7,14,0.02)_0%,rgba(8,7,14,0.3)_54%,rgba(8,7,14,0.82)_100%)]" />

      <div
        className="hero-grid-pan absolute inset-0 opacity-[0.06]"
        style={{
          backgroundImage:
            'linear-gradient(rgba(255,255,255,0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.04) 1px, transparent 1px)',
          backgroundSize: '88px 88px',
        }}
      />

      <div className="absolute left-1/2 top-[48%] h-[34rem] w-[34rem] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[radial-gradient(circle,rgba(0,255,178,0.08),rgba(0,255,178,0.025)_36%,transparent_72%)] blur-3xl" />

      <svg
        className="absolute inset-0 h-full w-full opacity-28"
        viewBox="0 0 1600 960"
        fill="none"
        preserveAspectRatio="xMidYMid slice"
      >
        <path
          className="hero-dash-path"
          d="M-60 660C120 540 190 570 300 480C390 408 428 310 520 292C650 266 736 418 856 404C948 394 974 294 1060 260C1184 210 1274 328 1412 304C1498 290 1572 222 1674 238"
          stroke="rgba(0,255,178,0.42)"
          strokeLinecap="round"
          strokeWidth="2.2"
        />
        <path
          className="hero-dash-path"
          d="M-40 760C74 744 160 690 232 640C340 562 430 448 544 456C662 466 696 634 832 646C956 656 1048 548 1130 466C1204 390 1288 314 1398 340C1498 364 1564 466 1678 480"
          stroke="rgba(121,166,255,0.22)"
          strokeLinecap="round"
          strokeWidth="1.8"
          style={{ animationDuration: '10.5s', animationDelay: '-2.5s' }}
        />
      </svg>

      <div className="absolute left-1/2 top-[46%] h-[28rem] w-[28rem] -translate-x-1/2 -translate-y-1/2 rounded-full border border-white/5" />
      <div className="absolute left-1/2 top-[46%] h-[34rem] w-[34rem] -translate-x-1/2 -translate-y-1/2 rounded-full border border-white/3" />
      <div className="hero-pulse-ring absolute left-1/2 top-[46%] h-[34rem] w-[34rem] -translate-x-1/2 -translate-y-1/2 rounded-full border border-[#00FFB2]/5" />

      <div className="absolute left-1/2 top-[46%] h-[38rem] w-[38rem] -translate-x-1/2 -translate-y-1/2 rounded-full">
        <div className="absolute inset-0 rounded-full border border-[#00FFB2]/9 motion-safe:animate-spin" style={{ animationDuration: '22s' }}>
          <div className="absolute left-1/2 top-[-7px] h-3.5 w-3.5 -translate-x-1/2 rounded-full bg-[#00FFB2] shadow-[0_0_14px_rgba(0,255,178,0.55)]" />
        </div>
        <div className="absolute inset-[11%] rounded-full border border-white/6 motion-safe:animate-spin" style={{ animationDuration: '28s', animationDirection: 'reverse' }}>
          <div className="absolute bottom-[-6px] left-[16%] h-3 w-3 rounded-full bg-[#79A6FF] shadow-[0_0_12px_rgba(121,166,255,0.5)]" />
        </div>
        <div className="absolute inset-[22%] rounded-full border border-[#00FFB2]/8 motion-safe:animate-spin" style={{ animationDuration: '16s' }}>
          <div className="absolute right-[14%] top-[-5px] h-2.5 w-2.5 rounded-full bg-white/72 shadow-[0_0_8px_rgba(255,255,255,0.45)]" />
        </div>
      </div>

      <div className="absolute left-[12%] top-[20%] hidden h-40 w-px bg-gradient-to-b from-transparent via-[#00FFB2]/26 to-transparent opacity-55 lg:block" />
      <div className="absolute right-[14%] top-[28%] hidden h-56 w-px bg-gradient-to-b from-transparent via-white/16 to-transparent lg:block" />
      <div className="absolute left-[24%] bottom-[18%] hidden h-28 w-px bg-gradient-to-b from-transparent via-[#79A6FF]/28 to-transparent lg:block" />

      <TickerLane items={tickerRows[0]} className="top-[17%] -rotate-[5deg] opacity-30" />
      <TickerLane items={tickerRows[1]} reverse={true} className="bottom-[15%] rotate-[4deg] opacity-24" />

      {floatingStats.map((card) => (
        <div
          key={card.label}
          className={`hero-float-slow absolute hidden rounded-2xl border border-white/7 bg-[#0A0A0F]/28 px-4 py-3 backdrop-blur-[2px] lg:block ${card.position}`}
          style={{ animationDelay: card.delay }}
        >
          <div className="text-[11px] uppercase tracking-[0.22em] text-[#D5D5D5]/42">{card.label}</div>
          <div className="mt-2 text-lg font-semibold text-white/86">{card.value}</div>
        </div>
      ))}

      <div className="absolute inset-x-0 bottom-0 h-36 bg-gradient-to-t from-[#08070E] to-transparent" />
    </div>
  );
}

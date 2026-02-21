import { useState, useMemo, useCallback } from "react";

// ─────────────────────────────────────────────────────────────
//  EXACT DISCRETE FORMULA
//  P(d, n, k) = Σ_{i=d+1}^{n} Σ_{j=1}^{k}  d/((i-1)·n) · C(n-i,j-1)/C(n-1,j-1)
// ─────────────────────────────────────────────────────────────
function comb(n, r) {
  if (r < 0 || r > n) return 0;
  if (r === 0 || r === n) return 1;
  if (r > n - r) r = n - r;
  let result = 1;
  for (let i = 0; i < r; i++) {
    result = (result * (n - i)) / (i + 1);
  }
  return result;
}

function P(d, n, k) {
  if (d === 0) return 0;
  let total = 0;
  const denomCache = [];
  for (let j = 1; j <= k; j++) denomCache[j] = comb(n - 1, j - 1);
  for (let i = d + 1; i <= n; i++) {
    const factor = d / ((i - 1) * n);
    for (let j = 1; j <= k; j++) {
      total += factor * (comb(n - i, j - 1) / denomCache[j]);
    }
  }
  return total;
}

function computeCurve(n, k) {
  const pts = [];
  let bestD = 1, bestP = 0;
  for (let d = 1; d < n; d++) {
    const p = P(d, n, k);
    pts.push({ d, p });
    if (p > bestP) { bestP = p; bestD = d; }
  }
  return { pts, bestD, bestP };
}

// ─────────────────────────────────────────────────────────────
//  COLOUR PALETTE  (matching original chart)
// ─────────────────────────────────────────────────────────────
const COL = {
  k1: "#1f8a5e",   // dark teal-green
  k3: "#5a1f9e",   // deep purple
  k5: "#c96810",   // burnt orange
  bg: "#f2f2f4",
  grid: "#dddde0",
  axis: "#888",
  explore: "#b0b0bb",
};

const STROKE_W = 2.2;
const DOT_R    = 5;

// ─────────────────────────────────────────────────────────────
//  SVG CHART COMPONENT
// ─────────────────────────────────────────────────────────────
function Chart({ n, hover, setHover }) {
  const W = 780, H = 420;
  const PAD = { top: 30, right: 30, bottom: 58, left: 62 };
  const cw = W - PAD.left - PAD.right;
  const ch = H - PAD.top  - PAD.bottom;

  // compute all three curves
  const c1 = useMemo(() => computeCurve(n, 1), [n]);
  const c3 = useMemo(() => computeCurve(n, 3), [n]);
  const c5 = useMemo(() => computeCurve(n, 5), [n]);

  // x: d/n in [0,1],  y: probability in [0, ~0.75]
  const xScale = d  => PAD.left + (d / n) * cw;
  const yScale = p  => PAD.top  + ch - p * ch / 0.80;   // 0.80 = y-axis max

  // polyline points string
  const polyline = (pts) =>
    pts.map(({ d, p }) => `${xScale(d)},${yScale(p)}`).join(" ");

  // filled polygon (curve + baseline)
  const polygon = (pts, alpha) => {
    const line = pts.map(({ d, p }) => `${xScale(d)},${yScale(p)}`).join(" ");
    const base = `${xScale(pts[pts.length-1].d)},${yScale(0)} ${xScale(pts[0].d)},${yScale(0)}`;
    return `${line} ${base}`;
  };

  // y-axis ticks 0%..70%
  const yTicks = [0, 0.10, 0.20, 0.30, 0.40, 0.50, 0.60, 0.70];

  // x-axis ticks: show 0, optimal ds, 25%, 50%, 75%, n
  const xTickFracs = [...new Set([
    0, c5.bestD/n, c3.bestD/n, c1.bestD/n, 0.25, 0.50, 0.75, 1.0
  ])].sort((a,b)=>a-b);

  // hover vertical line
  const hoverD = hover !== null ? hover : null;

  // annotation label positions (hand-tuned)
  const annots = [
    { curve: c5, col: COL.k5, label: `Top 5 → ${(c5.bestP*100).toFixed(1)}% at d=${c5.bestD}`, ax: 0.04, ay: c5.bestP + 0.06 },
    { curve: c3, col: COL.k3, label: `Top 3 → ${(c3.bestP*100).toFixed(1)}% at d=${c3.bestD}`, ax: 0.34, ay: c3.bestP + 0.06 },
    { curve: c1, col: COL.k1, label: `Top 1 → ${(c1.bestP*100).toFixed(1)}% at d=${c1.bestD}`, ax: 0.50, ay: c1.bestP - 0.10 },
  ];

  return (
    <svg
      width={W} height={H}
      onMouseMove={e => {
        const rect = e.currentTarget.getBoundingClientRect();
        const mx = e.clientX - rect.left - PAD.left;
        const d = Math.round((mx / cw) * n);
        setHover(d >= 1 && d < n ? d : null);
      }}
      onMouseLeave={() => setHover(null)}
      style={{ fontFamily: "'Georgia', serif", cursor: "crosshair" }}
    >
      {/* background */}
      <rect x={0} y={0} width={W} height={H} fill={COL.bg} rx={8} />
      <rect x={PAD.left} y={PAD.top} width={cw} height={ch} fill="white" rx={2} />

      {/* grid lines */}
      {yTicks.map(p => (
        <line key={p}
          x1={PAD.left} x2={PAD.left + cw}
          y1={yScale(p)} y2={yScale(p)}
          stroke={COL.grid} strokeWidth={1}
        />
      ))}

      {/* explore/commit divider at d* for k=1 */}
      <line
        x1={xScale(c1.bestD)} x2={xScale(c1.bestD)}
        y1={PAD.top} y2={PAD.top + ch}
        stroke={COL.explore} strokeWidth={1.5} strokeDasharray="5,4"
      />
      <text x={xScale(c1.bestD)/2 + PAD.left/2} y={PAD.top + 14}
        fill={COL.explore} fontSize={11} fontWeight="700"
        letterSpacing="2" textAnchor="middle">EXPLORE</text>
      <text x={xScale(c1.bestD) + (PAD.left + cw - xScale(c1.bestD))/2} y={PAD.top + 14}
        fill={COL.explore} fontSize={11} fontWeight="700"
        letterSpacing="2" textAnchor="middle">COMMIT</text>

      {/* filled areas */}
      {[
        { pts: c5.pts, col: COL.k5, opacity: 0.12 },
        { pts: c3.pts, col: COL.k3, opacity: 0.15 },
        { pts: c1.pts, col: COL.k1, opacity: 0.22 },
      ].map(({ pts, col, opacity }) => (
        <polygon key={col}
          points={polygon(pts)}
          fill={col} fillOpacity={opacity} stroke="none"
        />
      ))}

      {/* curves as polylines (discrete dots connected) */}
      {[
        { pts: c5.pts, col: COL.k5 },
        { pts: c3.pts, col: COL.k3 },
        { pts: c1.pts, col: COL.k1 },
      ].map(({ pts, col }) => (
        <polyline key={col}
          points={polyline(pts)}
          fill="none" stroke={col}
          strokeWidth={STROKE_W} strokeLinejoin="round"
        />
      ))}

      {/* optimal point markers */}
      {[
        { curve: c5, col: COL.k5 },
        { curve: c3, col: COL.k3 },
        { curve: c1, col: COL.k1 },
      ].map(({ curve, col }) => (
        <circle key={col}
          cx={xScale(curve.bestD)} cy={yScale(curve.bestP)}
          r={DOT_R} fill={col} stroke="white" strokeWidth={1.5}
        />
      ))}

      {/* vertical dashed lines at optima */}
      {[
        { curve: c5, col: COL.k5 },
        { curve: c3, col: COL.k3 },
        { curve: c1, col: COL.k1 },
      ].map(({ curve, col }) => (
        <line key={col}
          x1={xScale(curve.bestD)} x2={xScale(curve.bestD)}
          y1={yScale(curve.bestP)} y2={PAD.top + ch}
          stroke={col} strokeWidth={1.2} strokeDasharray="4,3"
          opacity={0.7}
        />
      ))}

      {/* annotation callouts */}
      {annots.map(({ curve, col, label, ax, ay }) => {
        const bx = PAD.left + ax * cw;
        const by = PAD.top + ch - ay * ch / 0.80;
        const bw = label.length * 6.8 + 16;
        const bh = 24;
        return (
          <g key={col}>
            <rect x={bx} y={by - bh/2} width={bw} height={bh}
              fill="white" fillOpacity={0.88}
              stroke={col} strokeWidth={1.2} rx={4}
            />
            <text x={bx + bw/2} y={by + 4.5}
              fill={col} fontSize={11} fontWeight="600" textAnchor="middle"
            >{label}</text>
          </g>
        );
      })}

      {/* hover line + tooltip */}
      {hoverD !== null && hoverD >= 1 && hoverD < n && (() => {
        const hx = xScale(hoverD);
        const p1h = P(hoverD, n, 1);
        const p3h = P(hoverD, n, 3);
        const p5h = P(hoverD, n, 5);
        const tx = hx + 12 < W - 160 ? hx + 12 : hx - 150;
        return (
          <g>
            <line x1={hx} x2={hx} y1={PAD.top} y2={PAD.top + ch}
              stroke="#333" strokeWidth={1} strokeDasharray="3,3" opacity={0.5} />
            {/* dots on each curve */}
            <circle cx={hx} cy={yScale(p5h)} r={3.5} fill={COL.k5} />
            <circle cx={hx} cy={yScale(p3h)} r={3.5} fill={COL.k3} />
            <circle cx={hx} cy={yScale(p1h)} r={3.5} fill={COL.k1} />
            {/* tooltip box */}
            <rect x={tx - 4} y={PAD.top + 6} width={148} height={72}
              fill="white" stroke="#ccc" strokeWidth={1} rx={5}
              style={{ filter: "drop-shadow(0 1px 4px rgba(0,0,0,.12))" }}
            />
            <text x={tx + 4} y={PAD.top + 22} fontSize={11} fill="#444" fontWeight="700">
              d = {hoverD}  (d/n = {(hoverD/n*100).toFixed(1)}%)
            </text>
            <text x={tx + 4} y={PAD.top + 38} fontSize={11} fill={COL.k1}>
              Top 1: {(p1h*100).toFixed(2)}%
            </text>
            <text x={tx + 4} y={PAD.top + 52} fontSize={11} fill={COL.k3}>
              Top 3: {(p3h*100).toFixed(2)}%
            </text>
            <text x={tx + 4} y={PAD.top + 66} fontSize={11} fill={COL.k5}>
              Top 5: {(p5h*100).toFixed(2)}%
            </text>
          </g>
        );
      })()}

      {/* y-axis labels */}
      {yTicks.map(p => (
        <text key={p}
          x={PAD.left - 8} y={yScale(p) + 4}
          fontSize={11} fill={COL.axis} textAnchor="end">
          {Math.round(p * 100)}%
        </text>
      ))}

      {/* x-axis ticks — show d values at optima, and round fractions */}
      {[
        { d: 0,           label: "0" },
        { d: c5.bestD,    label: `${c5.bestD}`, col: COL.k5 },
        { d: c3.bestD,    label: `${c3.bestD}`, col: COL.k3 },
        { d: c1.bestD,    label: `${c1.bestD}`, col: COL.k1 },
        { d: Math.round(n*0.5),  label: `${Math.round(n*0.5)}` },
        { d: n,           label: `${n}` },
      ].filter((v,i,arr) => arr.findIndex(x=>x.d===v.d)===i)
       .sort((a,b)=>a.d-b.d)
       .map(({ d, label, col }) => (
        <g key={d}>
          <line
            x1={xScale(d)} x2={xScale(d)}
            y1={PAD.top + ch} y2={PAD.top + ch + 5}
            stroke={col || COL.axis} strokeWidth={1.2}
          />
          <text
            x={xScale(d)} y={PAD.top + ch + 17}
            fontSize={11} fill={col || COL.axis}
            fontWeight={col ? "700" : "400"} textAnchor="middle">
            {label}
          </text>
        </g>
      ))}

      {/* axis labels */}
      <text x={PAD.left + cw/2} y={H - 6}
        fontSize={12} fill={COL.axis} textAnchor="middle">
        d — candidates explored before committing  (n = {n} total)
      </text>
      <text
        transform={`translate(14, ${PAD.top + ch/2}) rotate(-90)`}
        fontSize={12} fill={COL.axis} textAnchor="middle">
        P(d, n, k) — probability of success
      </text>

      {/* legend */}
      {[
        { col: COL.k1, label: "k = 1  (top 1)" },
        { col: COL.k3, label: "k = 3  (top 3)" },
        { col: COL.k5, label: "k = 5  (top 5)" },
      ].map(({ col, label }, i) => (
        <g key={col} transform={`translate(${PAD.left + cw - 145}, ${PAD.top + 16 + i * 22})`}>
          <line x1={0} y1={7} x2={22} y2={7} stroke={col} strokeWidth={2.5} />
          <circle cx={11} cy={7} r={3.5} fill={col} stroke="white" strokeWidth={1} />
          <text x={28} y={11.5} fontSize={11.5} fill="#333">{label}</text>
        </g>
      ))}

      {/* frame */}
      <rect x={PAD.left} y={PAD.top} width={cw} height={ch}
        fill="none" stroke={COL.grid} strokeWidth={1} />
    </svg>
  );
}

// ─────────────────────────────────────────────────────────────
//  FORMULA DISPLAY
// ─────────────────────────────────────────────────────────────
function Formula({ n, d, k }) {
  const p = d > 0 ? P(d, n, k) : null;
  return (
    <div style={{
      background: "white", border: "1px solid #e0e0e4",
      borderRadius: 8, padding: "14px 22px",
      fontFamily: "Georgia, serif", fontSize: 14, color: "#333",
      lineHeight: 1.9, marginBottom: 16,
    }}>
      <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 6, color: "#222" }}>
        Exact discrete formula
      </div>
      <div style={{ fontSize: 15, letterSpacing: 0.2 }}>
        <span style={{ color: "#555" }}>P(d, n, k) = </span>
        <span>
          ∑<sub style={{fontSize:11}}>i=d+1</sub><sup style={{fontSize:11}}>n</sup>{" "}
          ∑<sub style={{fontSize:11}}>j=1</sub><sup style={{fontSize:11}}>k</sup>{" "}
        </span>
        <span style={{
          display: "inline-flex", flexDirection: "column",
          alignItems: "center", verticalAlign: "middle", margin: "0 4px"
        }}>
          <span>d</span>
          <span style={{ borderTop: "1px solid #333", padding: "0 3px", fontSize: 13 }}>
            (i−1) · n
          </span>
        </span>
        <span> · </span>
        <span style={{
          display: "inline-flex", flexDirection: "column",
          alignItems: "center", verticalAlign: "middle", margin: "0 4px"
        }}>
          <span>C(n−i, j−1)</span>
          <span style={{ borderTop: "1px solid #333", padding: "0 3px" }}>
            C(n−1, j−1)
          </span>
        </span>
      </div>
      {d > 0 && (
        <div style={{ marginTop: 8, fontSize: 13, color: "#666" }}>
          Hover value:{" "}
          <strong style={{ color: "#222" }}>
            P(d={d}, n={n}, k={k}) = {(P(d, n, k)*100).toFixed(4)}%
          </strong>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
//  TABLE: optimal d* for each (n, k)
// ─────────────────────────────────────────────────────────────
function OptimalTable({ n }) {
  const rows = [1, 2, 3, 4, 5].map(k => {
    const { bestD, bestP } = computeCurve(n, k);
    return { k, bestD, bestP, ratio: bestD / n };
  });
  return (
    <table style={{
      borderCollapse: "collapse", fontSize: 13,
      fontFamily: "Georgia, serif", width: "100%", marginTop: 4
    }}>
      <thead>
        <tr style={{ borderBottom: "2px solid #ccc" }}>
          {["k", "d*", "d*/n", "P(d*, n, k)"].map(h => (
            <th key={h} style={{ padding: "6px 16px", color: "#555", fontWeight: 700, textAlign: "center" }}>
              {h}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map(({ k, bestD, bestP, ratio }) => (
          <tr key={k} style={{ borderBottom: "1px solid #eee" }}>
            <td style={{ padding: "5px 16px", textAlign: "center", fontWeight: 700,
              color: k===1 ? COL.k1 : k===3 ? COL.k3 : k===5 ? COL.k5 : "#333" }}>
              {k}
            </td>
            <td style={{ padding: "5px 16px", textAlign: "center" }}>{bestD}</td>
            <td style={{ padding: "5px 16px", textAlign: "center" }}>{(ratio*100).toFixed(1)}%</td>
            <td style={{ padding: "5px 16px", textAlign: "center", fontWeight: 600 }}>
              {(bestP*100).toFixed(2)}%
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

// ─────────────────────────────────────────────────────────────
//  ROOT APP
// ─────────────────────────────────────────────────────────────
export default function App() {
  const [n, setN] = useState(100);
  const [hover, setHover] = useState(null);
  const [showK, setShowK] = useState(3); // for formula display

  return (
    <div style={{
      background: "#f2f2f4", minHeight: "100vh",
      padding: "28px 32px", fontFamily: "Georgia, serif"
    }}>
      {/* Title */}
      <div style={{ marginBottom: 20 }}>
        <h1 style={{ margin: 0, fontSize: 26, fontWeight: 700, color: "#1a1a2e", letterSpacing: -0.5 }}>
          The Optimal Stopping Problem
        </h1>
        <p style={{ margin: "4px 0 0", fontSize: 14, color: "#777" }}>
          Exact discrete formula — P(d, n, k)
        </p>
      </div>

      {/* Controls */}
      <div style={{
        display: "flex", alignItems: "center", gap: 32,
        background: "white", borderRadius: 8, padding: "12px 22px",
        border: "1px solid #e0e0e4", marginBottom: 18, width: "fit-content"
      }}>
        <label style={{ fontSize: 14, color: "#444", display: "flex", alignItems: "center", gap: 12 }}>
          <strong>n =</strong>
          <input type="range" min={10} max={300} value={n}
            onChange={e => setN(Number(e.target.value))}
            style={{ width: 160, accentColor: "#1f8a5e" }}
          />
          <span style={{ fontWeight: 700, color: "#1a1a2e", minWidth: 28 }}>{n}</span>
        </label>
        <span style={{ color: "#ccc" }}>|</span>
        <span style={{ fontSize: 13, color: "#888" }}>
          Hover over chart to inspect values
        </span>
      </div>

      {/* Chart */}
      <div style={{ background: "white", borderRadius: 10, padding: 16,
        border: "1px solid #e0e0e4", display: "inline-block", marginBottom: 20 }}>
        <Chart n={n} hover={hover} setHover={setHover} />
      </div>

      {/* Bottom row: formula + table */}
      <div style={{ display: "flex", gap: 20, maxWidth: 780 }}>
        {/* Formula */}
        <div style={{ flex: 2 }}>
          <Formula n={n} d={hover ?? 0} k={showK} />
          <div style={{ fontSize: 13, color: "#888", lineHeight: 1.7, padding: "0 4px" }}>
            <strong style={{ color: "#555" }}>d</strong> = candidates explored before committing &nbsp;·&nbsp;
            <strong style={{ color: "#555" }}>n</strong> = total candidates &nbsp;·&nbsp;
            <strong style={{ color: "#555" }}>k</strong> = top-k success criterion<br/>
            The ratio C(n−i, j−1)/C(n−1, j−1) is the probability that all j−1 better
            candidates fall outside positions d+1..i−1, so candidate i is a running maximum.
          </div>
        </div>

        {/* Optimal table */}
        <div style={{ flex: 1.2, background: "white", borderRadius: 8,
          border: "1px solid #e0e0e4", padding: "14px 10px" }}>
          <div style={{ fontWeight: 700, fontSize: 14, color: "#222",
            marginBottom: 8, paddingLeft: 10 }}>
            Optimal d* for each k  (n = {n})
          </div>
          <OptimalTable n={n} />
        </div>
      </div>
    </div>
  );
}
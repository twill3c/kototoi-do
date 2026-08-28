/*
  暖簾。写真を使わないので(SPEC N-05)、店構えは図として引く。
  半円は橋の欄干、縦の線は暖簾の割れ目、下の波は隅田川である。
*/
export default function Noren() {
  return (
    <svg className="noren" viewBox="0 0 620 132" role="img" aria-label="言問橋のたもとに掛かる暖簾の図" preserveAspectRatio="xMidYMid meet">
      <defs>
        <clipPath id="noren-clip"><rect x="150" y="18" width="320" height="74" /></clipPath>
      </defs>
      {/* 橋 —— 欄干の弧と親柱 */}
      <path d="M20 96 Q310 34 600 96" fill="none" stroke="#d9d1be" strokeWidth="2" />
      <path d="M20 96 L20 118 M600 96 L600 118" stroke="#d9d1be" strokeWidth="2" />
      {[80, 160, 240, 320, 400, 480, 560].map((x, i) => {
        const t = (x - 20) / 580;
        const y = 96 - 62 * (1 - (2 * t - 1) ** 2) * 0.5 - 8;
        return <line key={i} x1={x} y1={y} x2={x} y2={96} stroke="#e6dfd0" strokeWidth="1.5" />;
      })}
      {/* 暖簾 */}
      <g clipPath="url(#noren-clip)">
        <rect x="150" y="18" width="320" height="74" fill="#8c3a3a" />
        <rect x="307" y="18" width="6" height="74" fill="#f6f2e9" />
        <text x="310" y="66" textAnchor="middle" fill="#f6f2e9" fontSize="30" letterSpacing="14"
              fontFamily="'Hiragino Mincho ProN','Yu Mincho',serif">言問堂</text>
      </g>
      <line x1="140" y1="18" x2="480" y2="18" stroke="#4a443c" strokeWidth="2.5" />
      {/* 川 */}
      <path d="M0 122 q40 -6 80 0 t80 0 t80 0 t80 0 t80 0 t80 0 t80 0 t80 0" fill="none" stroke="#cfd8dc" strokeWidth="1.5" />
      <path d="M0 130 q40 -6 80 0 t80 0 t80 0 t80 0 t80 0 t80 0 t80 0 t80 0" fill="none" stroke="#e0e6e8" strokeWidth="1.5" />
    </svg>
  );
}

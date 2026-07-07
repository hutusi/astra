// Decorative night-sky star field behind the child shell and login page.
// Positions are precomputed literals (seeded offline) — Math.random() in a
// server component would hydration-mismatch. Purely cosmetic: aria-hidden,
// pointer-events-none, sits behind content with the gradient backdrop.

// [x%, y%, radius, opacity]
const STARS: Array<[number, number, number, number]> = [
  [58.2, 52, 1.5, 0.46],
  [75.3, 68.9, 1, 0.22],
  [4.9, 22.6, 1, 0.6],
  [71, 67.1, 1, 0.27],
  [10.5, 89.9, 1.5, 0.53],
  [45.1, 28.1, 1.5, 0.17],
  [76.6, 96.3, 1.5, 0.2],
  [33.7, 65, 1, 0.27],
  [50.5, 76.8, 1, 0.38],
  [0.3, 57.7, 1, 0.44],
  [70.2, 85.4, 1.5, 0.25],
  [83.6, 42.8, 1.5, 0.21],
  [84.6, 29, 1, 0.37],
  [2.6, 15.4, 1.5, 0.26],
  [32.5, 61.4, 1, 0.41],
  [80.7, 60.8, 1, 0.19],
  [26.9, 8, 1.5, 0.59],
  [23.9, 81.4, 1, 0.34],
  [7.2, 2.6, 1, 0.31],
  [54.3, 99.4, 1, 0.32],
  [35.5, 63, 1, 0.16],
  [75.7, 43.2, 1.5, 0.23],
  [68.2, 53, 1.5, 0.43],
  [48.6, 41.8, 1, 0.16],
  [32.9, 54, 1, 0.59],
  [82.4, 59.6, 1, 0.58],
  [58.5, 59.5, 1, 0.19],
  [83.1, 67, 1, 0.5],
  [64.4, 86.7, 1, 0.21],
  [45.7, 6.8, 1.5, 0.3],
  [70.8, 50.8, 1, 0.19],
  [53.8, 44.8, 1.5, 0.16],
  [94.9, 93.6, 1, 0.43],
  [52.4, 46.1, 1, 0.25],
  [21.9, 9.3, 1, 0.6],
  [63.4, 23.1, 1, 0.28],
  [70.7, 88.5, 1, 0.18],
  [54.6, 76.8, 1, 0.26],
  [76.4, 93.9, 1, 0.16],
  [24.3, 18.1, 1, 0.26],
  [77, 26.2, 1, 0.24],
  [34.2, 4.4, 1.5, 0.15],
  [87.4, 7.2, 1, 0.24],
  [77.9, 31.8, 1, 0.4],
];

export function StarField() {
  return (
    <svg
      aria-hidden
      className="pointer-events-none fixed inset-0 -z-10 h-full w-full"
    >
      {STARS.map(([x, y, r, opacity], i) => (
        <circle
          key={i}
          cx={`${x}%`}
          cy={`${y}%`}
          r={r}
          fill="white"
          opacity={opacity}
          // every 7th star gets a slow twinkle, staggered
          className={i % 7 === 0 ? "animate-pulse" : undefined}
          style={
            i % 7 === 0 ? { animationDuration: `${3 + (i % 5)}s` } : undefined
          }
        />
      ))}
    </svg>
  );
}

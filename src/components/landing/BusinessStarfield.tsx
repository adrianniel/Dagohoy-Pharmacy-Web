import type { CSSProperties } from 'react';

// Seeded coordinates keep the decorative layers stable across renders.
function starPositions(count: number, seed: number) {
  let value = seed;
  const coordinate = () => {
    value = (value * 16807) % 2147483647;
    return value % 2000;
  };
  return Array.from({ length: count }, () => `${coordinate()}px ${coordinate()}px #fff`).join(', ');
}

const layers = [starPositions(700, 17), starPositions(200, 31), starPositions(100, 53)];

export function BusinessStarfield() {
  return (
    <div className="business-starfield" aria-hidden="true">
      {layers.map((positions, index) => (
        <div
          key={index}
          className={`business-starfield__layer business-starfield__layer--${index + 1}`}
          style={{ '--star-positions': positions } as CSSProperties}
        />
      ))}
    </div>
  );
}

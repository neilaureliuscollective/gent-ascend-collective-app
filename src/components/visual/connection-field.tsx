'use client';
import { usePathname } from 'next/navigation';

// Decorative route orientation only. This does not represent connected services or personal data.
const paths = [
  'M160 650C360 540 500 130 970 170S1410 550 1210 760',
  'M190 280C480 640 1150 720 1330 330S660 -20 490 380',
  'M640 880C430 620 590 120 1070 100S1480 550 1040 810',
  'M180 530C610 780 1260 300 1270 100',
];
export function ConnectionField() {
  const path = usePathname();
  const selected = path === '/world' ? 1 : path === '/progress' ? 2 : path === '/you' ? 3 : 0;
  return (
    <div className="connection-field" data-section={path}>
      <svg viewBox="0 0 1440 960" preserveAspectRatio="xMidYMin slice" focusable="false">
        <g fill="none" strokeWidth="0.8">
          {paths.map((d, i) => (
            <path
              key={d}
              d={d}
              className={i === selected ? 'connection-selected' : 'connection-track'}
            />
          ))}
          <circle cx="970" cy="170" r="72" className="connection-track" />
          <circle cx="970" cy="170" r="82" className="connection-track" strokeDasharray="1 10" />
        </g>
        <g className="connection-points">
          <circle cx="970" cy="170" r="3" />
          <circle cx="490" cy="380" r="2.5" />
          <circle cx="1040" cy="810" r="2" />
          <circle cx="180" cy="530" r="2" />
        </g>
      </svg>
      <div className="connection-arrival" key={path} />
    </div>
  );
}

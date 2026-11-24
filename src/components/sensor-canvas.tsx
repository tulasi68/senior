function heat(temp: number): string {
  const u = Math.min(1, Math.max(0, (temp - 21) / 13));
  const channel = Math.round(42 + u * (236 - 42));
  const g = Math.round(channel * (1 - 0.04 * u));
  const b = Math.round(channel * (1 - 0.1 * u));
  return `rgb(${channel} ${g} ${b})`;
}

export function ThermalCanvas({
  frame,
  floorY,
}: {
  frame: number[][] | null;
  floorY: number;
}) {
  const rows =
    frame ??
    Array.from({ length: 24 }, () => Array.from({ length: 32 }, () => 22));
  return (
    <div className="relative w-full" style={{ aspectRatio: "32 / 24" }}>
      <div
        className="grid h-full w-full"
        style={{
          gridTemplateColumns: "repeat(32, minmax(0, 1fr))",
          gridTemplateRows: "repeat(24, minmax(0, 1fr))",
        }}
        aria-hidden="true"
      >
        {rows.map((row, y) =>
          row.map((temp, x) => (
            <span key={`${y}-${x}`} style={{ backgroundColor: heat(temp) }} />
          )),
        )}
      </div>
      <div
        className="pointer-events-none absolute inset-x-0 border-t border-dashed border-faint"
        style={{ top: `${Math.min(100, Math.max(0, floorY * 100))}%` }}
      />
    </div>
  );
}

export function WaveCanvas({ samples }: { samples: number[] }) {
  const data = samples.length > 0 ? samples : [0];
  return (
    <div
      className="grid h-12 w-full overflow-hidden bg-card-2"
      style={{
        gridTemplateColumns: `repeat(${data.length}, minmax(0, 1fr))`,
        gridTemplateRows: "1fr",
        alignItems: "end",
        columnGap: "1px",
      }}
      aria-hidden="true"
    >
      {data.map((rms, index) => (
        <span
          key={index}
          className="block w-full bg-foreground"
          style={{ height: `${Math.max(8, Math.min(100, (rms / 0.4) * 100))}%` }}
        />
      ))}
    </div>
  );
}

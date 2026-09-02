'use client';

import React from 'react';

interface ProbabilityHistogramProps {
  probabilities: number[];
  stateLabels: string[];
}

export const ProbabilityHistogram: React.FC<ProbabilityHistogramProps> = ({
  probabilities,
  stateLabels,
}) => {
  return (
    <div className="w-full rounded-xl border border-border/40 bg-card/60 p-4 backdrop-blur-md">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-semibold tracking-wide text-foreground">
          State Probabilities
        </h3>
        <span className="text-xs text-muted-foreground">Real-time Simulation</span>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 md:grid-cols-8">
        {stateLabels.map((label, idx) => {
          const prob = probabilities[idx] ?? 0;
          const percentage = Math.round(prob * 100);

          return (
            <div
              key={label}
              className="flex flex-col items-center justify-end rounded-lg bg-muted/30 p-2 transition-all hover:bg-muted/50"
            >
              {/* Bar track */}
              <div className="relative flex h-24 w-full items-end justify-center rounded-md bg-secondary/50 p-1">
                <div
                  className="w-full rounded bg-gradient-to-t from-primary/80 to-primary transition-all duration-300 ease-out"
                  style={{ height: `${percentage}%` }}
                />
              </div>

              {/* State label & percentage */}
              <span className="mt-2 font-mono text-xs font-medium text-foreground">
                {label}
              </span>
              <span className="text-[11px] text-muted-foreground">{percentage}%</span>
            </div>
          );
        })}
      </div>
    </div>
  );
};
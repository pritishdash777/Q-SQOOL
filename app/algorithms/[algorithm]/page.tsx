import React from 'react';

export default function AlgorithmModulePage({ params }: { params: { algorithm: string } }) {
  return (
    <div className="page-enter mx-auto max-w-[1400px] p-5 sm:p-8">
      <h1 className="glow-text mt-2 text-4xl font-bold sm:text-5xl">Algorithm: {params.algorithm}</h1>
      <p className="mt-4 text-lg text-muted-foreground">Placeholder for the dynamic algorithm route. Replace with actual Algorithm view.</p>
    </div>
  );
}

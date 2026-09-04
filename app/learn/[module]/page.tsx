import React from 'react';

export default function LessonModulePage({ params }: { params: { module: string } }) {
  return (
    <div className="page-enter mx-auto max-w-[1400px] p-5 sm:p-8">
      <h1 className="glow-text mt-2 text-4xl font-bold sm:text-5xl">Lesson: {params.module}</h1>
      <p className="mt-4 text-lg text-muted-foreground">This is a placeholder page for the dynamic lesson route. Replace with the actual Lesson component.</p>
    </div>
  );
}

'use client';

import { useEffect, useState } from 'react';

export default function HomePage() {
  const [isDesktop, setIsDesktop] = useState(true);

  useEffect(() => {
    const checkScreen = () => {
      setIsDesktop(window.innerWidth >= 1024);
    };

    checkScreen();
    window.addEventListener('resize', checkScreen);

    return () => window.removeEventListener('resize', checkScreen);
  }, []);

  if (!isDesktop) {
    return (
      <main className="min-h-screen bg-slate-950 text-slate-100 flex flex-col items-center justify-center p-6 text-center">
        <h1 className="text-2xl font-semibold mb-4">
          Desktop Only 🖥️
        </h1>
        <p className="text-slate-300 max-w-md text-sm leading-relaxed">
          This game is built for large screens and is not available on mobile devices.
          Please open it on a desktop or laptop for the full experience.
        </p>
      </main>
    );
  }

  return (
    <GameWrapper />
  );
}

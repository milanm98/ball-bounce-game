'use client';

import { useEffect, useState } from 'react';
import GamePage from '../components/GamePage';

export default function HomePage() {
  const [isDesktop, setIsDesktop] = useState<boolean | null>(null);

  useEffect(() => {
    const checkScreen = () => {
      setIsDesktop(window.innerWidth >= 1024);
    };

    checkScreen();
    window.addEventListener('resize', checkScreen);
    return () => window.removeEventListener('resize', checkScreen);
  }, []);

  if (isDesktop === null) {
    return (
      <main className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center">
        <p className="text-xs text-slate-400">Loading…</p>
      </main>
    );
  }

  if (!isDesktop) {
    return (
      <main className="min-h-screen bg-slate-950 text-slate-100 flex flex-col items-center justify-center p-6 text-center">
        <h1 className="text-2xl font-semibold mb-4">
          Desktop Only 🖥️
        </h1>
        <p className="text-slate-300 max-w-md text-sm leading-relaxed">
          This game is built for large screens and is only available on desktop
          and laptop devices. Please open it on a bigger screen to start
          canceling meetings.
        </p>
      </main>
    );
  }

  return <GamePage />;
}

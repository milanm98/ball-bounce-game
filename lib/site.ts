import type { Metadata } from 'next';

export const SITE_URL = 'https://cancel-meet.vercel.app';
export const SITE_NAME = 'Cancel All Meetings';
export const SITE_DESCRIPTION =
  'A free desktop arcade game: bounce the ball, cancel your meetings, and dodge Milan’s meme chats. Can you clear your calendar?';

export const siteMetadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: 'Cancel All Meetings — Calendar Breakout Game',
  description: SITE_DESCRIPTION,
  applicationName: SITE_NAME,
  category: 'games',
  keywords: ['calendar game', 'breakout game', 'arcade game', 'browser game', 'cancel meetings'],
  alternates: { canonical: '/' },
  robots: { index: true, follow: true },
  openGraph: {
    type: 'website',
    locale: 'en_US',
    url: '/',
    siteName: SITE_NAME,
    title: SITE_NAME,
    description: SITE_DESCRIPTION,
    images: [{
      url: '/social-preview.png',
      width: 1200,
      height: 630,
      alt: 'Cancel All Meetings: a calendar breakout game with colorful meetings, an orange ball, and a blue paddle.',
    }],
  },
  twitter: {
    card: 'summary_large_image',
    title: SITE_NAME,
    description: SITE_DESCRIPTION,
    images: ['/social-preview.png'],
  },
};

export const gameStructuredData = {
  '@context': 'https://schema.org',
  '@type': 'VideoGame',
  name: SITE_NAME,
  description: SITE_DESCRIPTION,
  url: SITE_URL,
  image: `${SITE_URL}/social-preview.png`,
  genre: 'Arcade',
  gamePlatform: 'Desktop web browser',
  playMode: 'https://schema.org/SinglePlayer',
  isAccessibleForFree: true,
};

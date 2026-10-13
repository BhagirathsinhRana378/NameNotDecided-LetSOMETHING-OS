// Web apps that are allowed to be framed. embed:false opens in a popup window instead.
export const WEB_APPS = [
  { id: 'photopea',   name: 'Photopea',   url: 'https://www.photopea.com/',   icon: '🎨', embed: true },
  { id: 'excalidraw', name: 'Excalidraw', url: 'https://excalidraw.com/',     icon: '✏️', embed: true },
  { id: 'diagrams',   name: 'Diagrams',   url: 'https://app.diagrams.net/',   icon: '🧩', embed: true },
  { id: 'squoosh',    name: 'Squoosh',    url: 'https://squoosh.app/',        icon: '🗜️', embed: true },
  { id: 'spotify',    name: 'Spotify',    url: 'https://open.spotify.com/',   icon: '🎧', embed: true },
  { id: 'wikipedia',  name: 'Wikipedia',  url: 'https://en.wikipedia.org/',   icon: '📚', embed: true },
  { id: 'youtube',    name: 'YouTube',    url: 'https://www.youtube.com/',    icon: '▶️', embed: false },
  { id: 'clipchamp',  name: 'Video Editor', url: 'https://app.clipchamp.com/', icon: '🎬', embed: false }
];

export const WALLPAPERS = [
  { name: 'Harbour', css: 'radial-gradient(1200px 700px at 15% 10%, #3b6fa0 0%, transparent 60%), radial-gradient(900px 600px at 90% 85%, #e0875f 0%, transparent 55%), linear-gradient(160deg,#0c1a2e,#1b3350 55%,#2c4a63)' },
  { name: 'Moss',    css: 'radial-gradient(1000px 700px at 80% 15%, #8fb573 0%, transparent 58%), radial-gradient(900px 600px at 10% 90%, #2f5d50 0%, transparent 60%), linear-gradient(170deg,#0e1f1a,#1f3a31)' },
  { name: 'Plum',    css: 'radial-gradient(1000px 700px at 20% 85%, #c2578a 0%, transparent 55%), radial-gradient(900px 600px at 85% 10%, #5b4bb7 0%, transparent 60%), linear-gradient(160deg,#160f2a,#2a1c44)' },
  { name: 'Graphite',css: 'radial-gradient(1100px 700px at 50% 0%, #4a4f5e 0%, transparent 60%), linear-gradient(180deg,#171a22,#0d0f14)' }
];

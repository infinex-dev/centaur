import type { Metadata } from 'next';
import { ACTOR_MEMORY_VERSION } from '@pipeline/actor-memory';
import { RestartDevButton } from '@/components/RestartDevButton';
import './globals.css';

export const metadata: Metadata = {
  title: 'comms-factory · harness',
  description: 'Training harness for the comms-factory voice pipeline.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const hasKey = Boolean(process.env.ANTHROPIC_API_KEY);
  return (
    <html lang="en">
      <body className="app">
        <header className="appbar">
          <div className="appbar-inner">
            <a href="/" className="brand">
              <span className="brand-mark">
                <span>c</span>
              </span>
              comms<span className="brand-sep">·</span>factory
              <span className="brand-sep">/</span>
              <span className="brand-sub">harness</span>
            </a>
            <nav className="nav">
              <a href="/">queue</a>
              <a href="/shifts">training shifts</a>
              <a href="/director">director</a>
              <a href="/positioning">voice spec</a>
            </nav>
            <div className="appbar-meta">
              <span>
                <span className="dot" /> pipeline · ready
              </span>
              <span>·</span>
              <span>ANTHROPIC_API_KEY {hasKey ? '✓' : '✕'}</span>
              <span>·</span>
              <span>{ACTOR_MEMORY_VERSION}</span>
              <span>·</span>
              <span>v0.4 phase-1</span>
              <RestartDevButton />
            </div>
          </div>
        </header>
        <main className="main">{children}</main>
        <footer className="foot-hints">
          <div className="foot-hints-inner">
            <div className="group">
              <span className="item">
                <span className="kbd">j</span>
                <span className="kbd">k</span> navigate
              </span>
              <span className="item">
                <span className="kbd">a</span>/<span className="kbd">e</span>/<span className="kbd">x</span>/<span className="kbd">r</span> decide
              </span>
              <span className="item">
                <span className="kbd">enter</span> open
              </span>
            </div>
            <div className="group">
              <span className="item">training harness · 80% agreement → autonomous use</span>
            </div>
          </div>
        </footer>
      </body>
    </html>
  );
}

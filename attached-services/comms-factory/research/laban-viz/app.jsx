// Main app: surfaces grid + detail modal.

const { useState: _useState, useEffect: _useEffect, useMemo: _useMemo, useCallback: _useCallback } = React;

function brandOf(label) {
  if (label.toLowerCase().startsWith("phantom")) return "Phantom";
  if (label.toLowerCase().startsWith("infinex")) return "Infinex";
  return "Other";
}

function topInners(innerCounts, n=2) {
  return Object.entries(innerCounts)
    .filter(([, c]) => c > 0)
    .sort((a,b) => b[1] - a[1])
    .slice(0, n)
    .map(([k]) => k);
}

function App() {
  const [surfaces, setSurfaces] = _useState(null);
  const [activeIdx, setActiveIdx] = _useState(null);
  const [hoveredTempo, setHoveredTempo] = _useState(null);

  _useEffect(() => {
    fetch("data/tallies.json").then(r => r.json()).then(setSurfaces);
  }, []);

  _useEffect(() => {
    function onKey(e) {
      if (activeIdx === null) return;
      if (e.key === "Escape") setActiveIdx(null);
      if (e.key === "ArrowRight") setActiveIdx(i => (i + 1) % surfaces.length);
      if (e.key === "ArrowLeft") setActiveIdx(i => (i - 1 + surfaces.length) % surfaces.length);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [activeIdx, surfaces]);

  if (!surfaces) {
    return <div className="loading">loading classifications…</div>;
  }

  const phantom = surfaces.filter(s => brandOf(s.label) === "Phantom");
  const infinex = surfaces.filter(s => brandOf(s.label) === "Infinex");

  return (
    <div className="app">
      <Header />
      <Legend />
      <section className="surface-section">
        <SectionHeader brand="Phantom" surfaces={phantom} />
        <SurfaceGrid surfaces={phantom} all={surfaces} onOpen={i => setActiveIdx(surfaces.indexOf(phantom[i]))} />
      </section>
      <section className="surface-section">
        <SectionHeader brand="Infinex" surfaces={infinex} />
        <SurfaceGrid surfaces={infinex} all={surfaces} onOpen={i => setActiveIdx(surfaces.indexOf(infinex[i]))} />
      </section>
      <Footer />
      {activeIdx !== null && (
        <DetailModal
          surfaces={surfaces}
          idx={activeIdx}
          setIdx={setActiveIdx}
          hoveredTempo={hoveredTempo}
          setHoveredTempo={setHoveredTempo}
          onClose={() => { setActiveIdx(null); setHoveredTempo(null); }}
        />
      )}
    </div>
  );
}

function Header() {
  return (
    <header className="masthead">
      <div className="masthead-eyebrow">
        <span className="eyebrow-dot" /> Operator architecture · 2026-05-18
      </div>
      <h1 className="masthead-title">The 3-shell Laban viz</h1>
      <p className="masthead-lede">
        Mirodan's character-placement framework, applied to 9 communication surfaces across two brands.
        Each circle is a single surface; the rings move from <em>intent</em> at the core to <em>texture</em> at the rim.
        Click any surface to read it closely.
      </p>
      <div className="masthead-architecture">
        <ArchitectureKey />
      </div>
    </header>
  );
}

function ArchitectureKey() {
  return (
    <div className="arch-key">
      <div className="arch-row">
        <span className="arch-label arch-num">01</span>
        <span className="arch-name">Aspects</span>
        <span className="arch-count">4 nodes · core</span>
        <span className="arch-desc">What's leading the motion — Weight, Space, Flow, or Time.</span>
      </div>
      <div className="arch-row">
        <span className="arch-label arch-num">02</span>
        <span className="arch-name">Inner attitudes</span>
        <span className="arch-count">6 nodes · middle</span>
        <span className="arch-desc">Two-factor inner state. Baselines (solid) and action attitudes (dashed).</span>
      </div>
      <div className="arch-row">
        <span className="arch-label arch-num">03</span>
        <span className="arch-name">Tempi</span>
        <span className="arch-count">24 nodes · rim</span>
        <span className="arch-desc">The texture: 4 tempi per attitude, fanning radially. Dot size = sample count.</span>
      </div>
    </div>
  );
}

function Legend() {
  const F = window.LABAN;
  return (
    <div className="legend-strip">
      <div className="legend-block">
        <div className="legend-block-title">Baselines</div>
        <div className="legend-chips">
          {["Stable","Near","Adream"].map(k =>
            <LegendChip key={k} name={k} color={F.INNER_COLOR[k]} desc={F.INNER_DESCRIPTOR[k]} baseline />
          )}
        </div>
      </div>
      <div className="legend-block">
        <div className="legend-block-title">Action attitudes</div>
        <div className="legend-chips">
          {["Awake","Mobile","Remote"].map(k =>
            <LegendChip key={k} name={k} color={F.INNER_COLOR[k]} desc={F.INNER_DESCRIPTOR[k]} />
          )}
        </div>
      </div>
      <div className="legend-block">
        <div className="legend-block-title">Aspects</div>
        <div className="legend-chips">
          {Object.keys(F.ASPECT_COLOR).map(k =>
            <LegendChip key={k} name={k} color={F.ASPECT_COLOR[k]} desc={F.ASPECT_DESCRIPTOR[k]} small />
          )}
        </div>
      </div>
      <div className="legend-block">
        <div className="legend-block-title">Drives (destination)</div>
        <div className="legend-chips">
          {["doing","spell","passion","vision"].map(k =>
            <LegendChip key={k} name={k} color={F.DRIVE_COLOR[k]}
              desc={k === "vision" ? "Weight-latent" : k === "passion" ? "Space-latent" : k === "spell" ? "Time-latent" : "Flow-latent"}
              small
            />
          )}
        </div>
      </div>
    </div>
  );
}

function LegendChip({ name, color, desc, baseline, small }) {
  return (
    <div className={`legend-chip ${small ? 'legend-chip-sm' : ''}`}>
      <span className="legend-chip-dot"
        style={{
          background: color,
          borderStyle: baseline === undefined ? 'solid' : (baseline ? 'solid' : 'dashed'),
          borderColor: color,
        }}
      />
      <span className="legend-chip-name">{name[0].toUpperCase() + name.slice(1)}</span>
      <span className="legend-chip-desc">{desc}</span>
    </div>
  );
}

function SectionHeader({ brand, surfaces }) {
  const total = surfaces.reduce((s, x) => s + x.total, 0);
  return (
    <div className="section-header">
      <div className="section-header-left">
        <span className="section-rule" />
        <h2 className="section-title">{brand}</h2>
      </div>
      <div className="section-header-right">
        <span className="section-meta"><b>{surfaces.length}</b> surfaces</span>
        <span className="section-meta-sep">·</span>
        <span className="section-meta"><b>{total}</b> samples classified</span>
      </div>
    </div>
  );
}

function SurfaceGrid({ surfaces, onOpen }) {
  return (
    <div className="surface-grid">
      {surfaces.map((s, i) => (
        <SurfaceCard key={s.label} surface={s} onClick={() => onOpen(i)} />
      ))}
    </div>
  );
}

function SurfaceCard({ surface, onClick }) {
  const top = topInners(surface.innerCounts, 2);
  const surfaceName = surface.label.replace(/^(Phantom|Infinex)\s+/, '');
  return (
    <button className="surface-card" onClick={onClick} aria-label={`Open ${surface.label}`}>
      <div className="surface-card-head">
        <div className="surface-card-name">{surfaceName}</div>
        <div className="surface-card-n font-mono">n = {surface.total}</div>
      </div>
      <div className="surface-card-fp">
        <FingerprintBar innerCounts={surface.innerCounts} driveAxisCounts={surface.driveAxisCounts} total={surface.total} height={10} />
      </div>
      <div className="surface-card-top">
        <span className="surface-card-top-label">reads as</span>
        <span className="surface-card-top-vals">
          {top.map((k, i) => (
            <span key={k} className="surface-card-top-pill">
              <span className="dot" style={{ background: window.LABAN.INNER_COLOR[k] }}></span>
              {k}
            </span>
          ))}
        </span>
      </div>
      <div className="surface-card-viz">
        <Shell3 tally={surface} size={420} mode="compact" />
      </div>
      <div className="surface-card-foot">
        <span className="surface-card-zoom font-mono">click to inspect →</span>
      </div>
    </button>
  );
}

function DetailModal({ surfaces, idx, setIdx, onClose, hoveredTempo, setHoveredTempo }) {
  const F = window.LABAN;
  const s = surfaces[idx];
  const sortedTempi = _useMemo(() => {
    return Object.entries(s.tempoCounts || {})
      .sort((a,b) => b[1] - a[1])
      .map(([t,c]) => ({ tempo: t, count: c, inner: window.LABAN.INNER_TEMPI && (Object.entries(window.LABAN.INNER_TEMPI).find(([_,ts]) => ts.includes(t)) || [null])[0] }));
  }, [s]);
  const totalTempi = sortedTempi.reduce((sum,x) => sum + x.count, 0);

  return (
    <div className="modal-scrim" onClick={onClose}>
      <div className="modal-shell" onClick={e => e.stopPropagation()}>
        <div className="modal-head">
          <div>
            <div className="modal-eyebrow font-mono">
              {brandOf(s.label).toUpperCase()} · surface {idx + 1} of {surfaces.length}
            </div>
            <h2 className="modal-title">{s.label.replace(/^(Phantom|Infinex)\s+/, '')}</h2>
            <div className="modal-sub font-mono">{s.total} samples · {totalTempi} tempi assignments</div>
          </div>
          <div className="modal-controls">
            <button className="modal-nav font-mono"
              onClick={() => setIdx((idx - 1 + surfaces.length) % surfaces.length)}
              aria-label="Previous"
            >← prev</button>
            <button className="modal-nav font-mono"
              onClick={() => setIdx((idx + 1) % surfaces.length)}
              aria-label="Next"
            >next →</button>
            <button className="modal-close" onClick={onClose} aria-label="Close">×</button>
          </div>
        </div>
        <div className="modal-body">
          <div className="modal-viz-col">
            <Shell3 tally={s} size={680} mode="detail"
              onTempoHover={setHoveredTempo} hoveredTempo={hoveredTempo}
            />
            <div className="modal-fp">
              <div className="modal-fp-title font-mono">Inner-attitude fingerprint</div>
              <FingerprintBar innerCounts={s.innerCounts} driveAxisCounts={s.driveAxisCounts} total={s.total} height={28} showLabels />
            </div>
          </div>
          <aside className="modal-side">
            <SidePanel
              surface={s} sortedTempi={sortedTempi} totalTempi={totalTempi}
              hoveredTempo={hoveredTempo} setHoveredTempo={setHoveredTempo}
            />
          </aside>
        </div>
      </div>
    </div>
  );
}

function SidePanel({ surface, sortedTempi, totalTempi, hoveredTempo, setHoveredTempo }) {
  const F = window.LABAN;
  const innerByCount = Object.entries(surface.innerCounts)
    .sort((a,b) => b[1] - a[1]);
  const totalAtt = innerByCount.reduce((s,[,c]) => s+c, 0);

  return (
    <>
      <div className="side-section">
        <div className="side-title font-mono">Inner attitudes</div>
        <div className="side-table">
          {innerByCount.map(([k, c]) => {
            const pct = totalAtt > 0 ? (c/totalAtt)*100 : 0;
            return (
              <div key={k} className="side-row">
                <span className="side-row-dot"
                  style={{
                    background: F.INNER_COLOR[k],
                    borderStyle: F.BASELINES.has(k) ? 'solid' : 'dashed',
                    borderColor: F.INNER_COLOR[k],
                  }}
                />
                <span className="side-row-name">{k}</span>
                <span className="side-row-desc">{F.INNER_DESCRIPTOR[k]}</span>
                <span className="side-row-bar">
                  <span className="side-row-bar-fill"
                    style={{ width: `${pct}%`, background: F.INNER_COLOR[k] }} />
                </span>
                <span className="side-row-n font-mono">{c}</span>
              </div>
            );
          })}
        </div>
      </div>

      <div className="side-section">
        <div className="side-title font-mono">Main Character-Action Axis</div>
        <div className="side-table">
          {(() => {
            const axes = Object.entries(surface.driveAxisCounts || {})
              .sort((a,b) => b[1] - a[1]);
            const totalDrive = axes.reduce((s, [,c]) => s + c, 0);
            if (totalDrive === 0) {
              return <div className="tempi-empty">no drive data</div>;
            }
            return axes.map(([axis, c]) => {
              const pct = (c / totalDrive) * 100;
              const dest = F.axisDestination(axis);
              const color = F.axisColor(axis);
              return (
                <div key={axis} className="side-row">
                  <span className="side-row-dot"
                    style={{ background: color, borderColor: color }}
                  />
                  <span className="side-row-name">{axis}</span>
                  <span className="side-row-desc">{dest && `→ ${dest}-dest.`}</span>
                  <span className="side-row-bar">
                    <span className="side-row-bar-fill"
                      style={{ width: `${pct}%`, background: color }} />
                  </span>
                  <span className="side-row-n font-mono">{c}</span>
                </div>
              );
            });
          })()}
        </div>
      </div>

      <div className="side-section">
        <div className="side-title font-mono">Aspect (motion-led)</div>
        <div className="side-table">
          {Object.entries(F.ASPECT_COLOR).map(([k, color]) => {
            const c = surface.aspectCounts[k] || 0;
            return (
              <div key={k} className="side-row">
                <span className="side-row-dot" style={{ background: color, borderColor: color }} />
                <span className="side-row-name">{k}</span>
                <span className="side-row-desc">{F.ASPECT_DESCRIPTOR[k]}</span>
                <span className="side-row-bar">
                  <span className="side-row-bar-fill"
                    style={{ width: `${surface.total > 0 ? (c/surface.total)*100 : 0}%`, background: color }} />
                </span>
                <span className="side-row-n font-mono">{c}</span>
              </div>
            );
          })}
        </div>
      </div>

      <div className="side-section">
        <div className="side-title font-mono">Tempi · {sortedTempi.length} active</div>
        <div className="tempi-list">
          {sortedTempi.length === 0 && <div className="tempi-empty">no tempi assigned</div>}
          {sortedTempi.map(({ tempo, count, inner }) => {
            const det = F.TEMPO_DETAIL[tempo];
            const isHover = hoveredTempo === tempo;
            const examples = (surface.exemplars && surface.exemplars[tempo]) || [];
            return (
              <div key={tempo}
                className={`tempi-item ${isHover ? 'tempi-item-hover' : ''}`}
                onMouseEnter={() => setHoveredTempo(tempo)}
                onMouseLeave={() => setHoveredTempo(null)}
              >
                <div className="tempi-item-head">
                  <span className="tempi-item-dot" style={{ background: inner ? F.INNER_COLOR[inner] : '#aaa' }} />
                  <span className="tempi-item-name">{tempo}</span>
                  <span className="tempi-item-count font-mono">{count}</span>
                </div>
                {det && (
                  <div className="tempi-item-meta font-mono">
                    {det.pole} · <em>{det.motor}</em>
                  </div>
                )}
                {isHover && examples.length > 0 && (
                  <div className="tempi-item-examples">
                    {examples.map((ex, i) => (
                      <div key={i} className="tempi-example">"{ex}"</div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </>
  );
}

function Footer() {
  return (
    <footer className="masthead-foot">
      <div className="foot-row">
        <span className="foot-label font-mono">Drives</span>
        <span className="foot-text">
          Each placement carries a <b>Main Character-Action Axis</b> (Mirodan X-diagram) =
          primary drive → extravert drive. Tempo dots are <b>filled by destination drive</b>
          (where the placement projects to) and <b>outlined by inner-attitude family</b>.
          Hover any dot to see the dominant axis observed in this surface.
        </span>
      </div>
      <div className="foot-row">
        <span className="foot-label font-mono">Read</span>
        <span className="foot-text">
          Eye scan: <b>fingerprint rows</b> first (top = inner-attitude shape, bottom = drive-axis pointing),
          then <b>shells</b> for full topology. Open any surface for tempi, aspects, exemplars,
          and the canonical pole + motor pair per tempo.
        </span>
      </div>
    </footer>
  );
}

ReactDOM.createRoot(document.getElementById("root")).render(<App />);

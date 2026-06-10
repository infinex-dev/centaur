// FingerprintBar: two stacked rows per surface.
// Row 1 — inner-attitude proportions (the "shape" of the voice).
// Row 2 — drive-axis proportions (where the voice POINTS: which destination
// drive each placement projects to). Colored by destination drive.

function FingerprintBar({ innerCounts, total, driveAxisCounts, height = 18, showLabels = false }) {
  const F = window.LABAN;
  const order = F.INNER_ORDER;
  const totalAtt = order.reduce((s, k) => s + (innerCounts[k] || 0), 0);
  if (totalAtt === 0) {
    return <div className="fp-empty" style={{ height }}>no attitude data</div>;
  }

  const axes = F.DRIVE_AXIS_ORDER.filter(a => (driveAxisCounts && driveAxisCounts[a] > 0));
  const totalDrive = axes.reduce((s, a) => s + (driveAxisCounts[a] || 0), 0);
  const driveHeight = Math.max(6, Math.round(height * 0.55));

  return (
    <div className="fp-wrap">
      <div className="fp-bar" style={{ height }}>
        {order.map(k => {
          const c = innerCounts[k] || 0;
          if (c === 0) return null;
          const pct = (c / totalAtt) * 100;
          return (
            <div key={k}
              className="fp-seg"
              title={`${k}: ${c} (${pct.toFixed(0)}%)`}
              style={{
                width: `${pct}%`,
                background: F.INNER_COLOR[k],
                borderTopStyle: F.BASELINES.has(k) ? 'solid' : 'dashed',
              }}
            >
              {showLabels && pct > 9 && (
                <span className="fp-seg-label">{k} {Math.round(pct)}</span>
              )}
            </div>
          );
        })}
      </div>
      {totalDrive > 0 && (
        <div className="fp-bar fp-drive-row" style={{ height: driveHeight, marginTop: 2 }}>
          {axes.map(a => {
            const c = driveAxisCounts[a];
            const pct = (c / totalDrive) * 100;
            return (
              <div key={a}
                className="fp-seg fp-drive-seg"
                title={`${a}: ${c} (${pct.toFixed(0)}%)`}
                style={{
                  width: `${pct}%`,
                  background: F.axisColor(a),
                  borderTopStyle: 'solid',
                  borderTopColor: F.DRIVE_COLOR[F.axisDestination(a)] || '#888',
                }}
              >
                {showLabels && pct > 14 && (
                  <span className="fp-seg-label">{a} {Math.round(pct)}</span>
                )}
              </div>
            );
          })}
        </div>
      )}
      {showLabels && (
        <div className="fp-totals">
          <span className="fp-totals-mono">{totalAtt}</span> attitude assignments
          {totalDrive > 0 && (<> · <span className="fp-totals-mono">{totalDrive}</span> drive-axis assignments</>)}
          {" · "}{total} samples
        </div>
      )}
    </div>
  );
}

window.FingerprintBar = FingerprintBar;

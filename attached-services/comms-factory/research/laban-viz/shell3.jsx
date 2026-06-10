// 3-shell Laban viz — React component for both compact and detail views.

const { useState, useMemo } = React;

function Shell3({ tally, size = 560, mode = "compact", onTempoHover, hoveredTempo }) {
  const F = window.LABAN;
  const cx = size / 2;
  const cy = size / 2;
  const isDetail = mode === "detail";

  // Geometry. Detail mode reserves more outer space for labels.
  const rInner  = size * (isDetail ? 0.22  : 0.25);
  const rTempo  = size * (isDetail ? 0.33  : 0.38);
  const labelR  = rTempo + (isDetail ? 24 : 14);

  const total = tally.total || 1;
  const tCounts = tally.tempoCounts || {};
  const iCounts = tally.innerCounts || {};
  const aCounts = tally.aspectCounts || {};
  const dByTempo = tally.driveByTempo || {};

  // ─── Layer 1: stress triangles ────────────────────────
  const triangles = F.STRESS_TRIANGLES.map(({ baselines, action }) => {
    const [n1, n2] = baselines;
    const p1 = F.polar(F.INNER_ANGLES[n1], cx, cy, rInner);
    const p2 = F.polar(F.INNER_ANGLES[n2], cx, cy, rInner);
    const p3 = F.polar(F.INNER_ANGLES[action], cx, cy, rInner);
    return {
      action,
      pts: `${p1[0]},${p1[1]} ${p2[0]},${p2[1]} ${p3[0]},${p3[1]}`,
    };
  });

  // ─── Layer 2: aspect → inner edges ────────────────────
  const aspectEdges = [];
  for (const [aspect, inners] of Object.entries(F.ASPECT_INNERS)) {
    const [ax, ay] = F.aspectCentroid(aspect, cx, cy, rInner);
    for (const inner of inners) {
      const [ix, iy] = F.polar(F.INNER_ANGLES[inner], cx, cy, rInner);
      aspectEdges.push({ aspect, ax, ay, ix, iy, key: `${aspect}-${inner}` });
    }
  }

  // ─── Layer 3: inner hexagon edges ─────────────────────
  const innerEdges = F.INNER_EDGES.map(([a, b]) => {
    const [ax, ay] = F.polar(F.INNER_ANGLES[a], cx, cy, rInner);
    const [bx, by] = F.polar(F.INNER_ANGLES[b], cx, cy, rInner);
    return { a, b, ax, ay, bx, by, key: `${a}-${b}` };
  });

  // ─── Layer 4: tempi spokes + dots + label positions ───
  // Horizontal labels with smart anchor — never rotated.
  const spokes = [];
  for (const [inner, tempi] of Object.entries(F.INNER_TEMPI)) {
    const [ix, iy] = F.polar(F.INNER_ANGLES[inner], cx, cy, rInner);
    const baseAngle = F.INNER_ANGLES[inner];
    const spread = 50;
    tempi.forEach((tempo, j) => {
      const ang = baseAngle + (j - 1.5) * (spread / 3);
      const [tx, ty] = F.polar(ang, cx, cy, rTempo);
      const [lx, ly] = F.polar(ang, cx, cy, labelR);
      const count = tCounts[tempo] || 0;
      const pct = count / total;
      const rDot = isDetail
        ? 4 + 18 * Math.pow(pct, 0.55)
        : 2 + 10 * Math.pow(pct, 0.55);
      const opacity = count > 0 ? 0.92 : 0.18;
      // Smart anchor based on angle
      const rad = ang * Math.PI / 180;
      const cosA = Math.cos(rad);
      let anchor = "middle";
      if (cosA > 0.15) anchor = "start";
      else if (cosA < -0.15) anchor = "end";
      // Vertical offset: text baseline. Push labels above/below center cleanly.
      const sinA = Math.sin(rad); // remember math y, positive=top
      const dyBase = -sinA > 0.3 ? -2 : (-sinA < -0.3 ? 12 : 4); // top: shift up, bottom: shift down
      // Drive: dominant axis for this tempo on this surface. Spoke FILL = drive
      // destination ("where this tempo points"). Outer STROKE stays inner-
      // attitude color (so the family grouping remains legible). Empty tempi
      // fall back to inner color on both layers.
      const driveAxis = F.dominantAxis(dByTempo[tempo]);
      const driveFill = driveAxis ? F.axisColor(driveAxis) : F.INNER_COLOR[inner];
      spokes.push({
        inner, tempo, ang, ix, iy, tx, ty, rDot, opacity, count, pct,
        lx, ly, anchor, dyBase, driveAxis, driveFill,
        key: `${inner}-${tempo}`,
      });
    });
  }

  // ─── Layer 5: inner nodes ─────────────────────────────
  const innerNodes = Object.entries(F.INNER_ANGLES).map(([inner, angle]) => {
    const [ix, iy] = F.polar(angle, cx, cy, rInner);
    const count = iCounts[inner] || 0;
    const pct = count / total;
    const r = isDetail
      ? 22 + 26 * Math.pow(pct, 0.5)
      : 11 + 15 * Math.pow(pct, 0.5);
    return { inner, ix, iy, count, pct, r, isBaseline: F.BASELINES.has(inner) };
  });

  // ─── Layer 6: aspect nodes ────────────────────────────
  const aspectNodes = Object.keys(F.ASPECT_INNERS).map((aspect) => {
    const [ax, ay] = F.aspectCentroid(aspect, cx, cy, rInner);
    const count = aCounts[aspect] || 0;
    const pct = count / total;
    const r = isDetail
      ? 14 + 12 * Math.pow(pct, 0.5)
      : 6 + 6 * Math.pow(pct, 0.5);
    return { aspect, ax, ay, count, pct, r };
  });

  const fadeUnhovered = isDetail && hoveredTempo;
  const hoveredSpoke = isDetail && hoveredTempo
    ? spokes.find(s => s.tempo === hoveredTempo) : null;

  return (
    <svg viewBox={`0 0 ${size} ${size}`} xmlns="http://www.w3.org/2000/svg" className="shell3-svg">
      {/* stress triangles */}
      {triangles.map(t => (
        <polygon
          key={t.action}
          points={t.pts}
          fill={F.INNER_COLOR[t.action]}
          fillOpacity={isDetail ? 0.05 : 0.04}
          stroke={F.INNER_COLOR[t.action]}
          strokeOpacity={isDetail ? 0.20 : 0.16}
          strokeWidth="1"
          strokeDasharray="3,3"
        />
      ))}

      {/* aspect→inner edges (form a triangle through each aspect node) */}
      {aspectEdges.map(e => (
        <line key={e.key}
          x1={e.ax} y1={e.ay} x2={e.ix} y2={e.iy}
          stroke={F.ASPECT_COLOR[e.aspect]} strokeOpacity="0.32" strokeWidth="1"
        />
      ))}

      {/* inner hexagon edges */}
      {innerEdges.map(e => (
        <line key={e.key}
          x1={e.ax} y1={e.ay} x2={e.bx} y2={e.by}
          stroke="#a8a29e" strokeOpacity="0.4" strokeWidth="0.8"
        />
      ))}

      {/* tempi spokes */}
      {spokes.map(s => (
        <line key={s.key + "-line"}
          x1={s.ix} y1={s.iy} x2={s.tx} y2={s.ty}
          stroke={F.INNER_COLOR[s.inner]}
          strokeOpacity={fadeUnhovered ? (hoveredTempo === s.tempo ? 0.7 : 0.08) : 0.2}
          strokeWidth="0.7"
        />
      ))}

      {/* tempi dots */}
      {spokes.map(s => (
        <g key={s.key}>
          <circle
            cx={s.tx} cy={s.ty} r={Math.max(s.rDot + 4, isDetail ? 10 : 0)}
            fill="transparent"
            style={{ cursor: isDetail ? 'pointer' : 'default' }}
            onMouseEnter={isDetail && onTempoHover ? () => onTempoHover(s.tempo) : undefined}
            onMouseLeave={isDetail && onTempoHover ? () => onTempoHover(null) : undefined}
          />
          <circle
            cx={s.tx} cy={s.ty} r={s.rDot}
            fill={s.driveFill}
            fillOpacity={fadeUnhovered ? (hoveredTempo === s.tempo ? 1 : 0.16) : s.opacity}
            stroke={F.INNER_COLOR[s.inner]}
            strokeOpacity={fadeUnhovered && hoveredTempo !== s.tempo ? 0.2 : 0.9}
            strokeWidth={hoveredTempo === s.tempo ? 2 : (s.driveAxis ? 1.4 : 0.6)}
            style={{ pointerEvents: 'none', transition: 'fill-opacity 0.15s' }}
          />
          {/* DETAIL labels — horizontal, single line */}
          {isDetail && (
            <text
              x={s.lx} y={s.ly + s.dyBase}
              textAnchor={s.anchor}
              fontSize="12.5"
              fontWeight={hoveredTempo === s.tempo ? 700 : 500}
              fill={fadeUnhovered && hoveredTempo !== s.tempo ? "#bfb9af" : "#1a1814"}
              className="shell3-tempo-label"
              style={{ pointerEvents: 'none', transition: 'fill 0.15s' }}
            >
              {s.tempo}
              {s.count > 0 && (
                <tspan
                  fontSize="11"
                  fontWeight="500"
                  fill={fadeUnhovered && hoveredTempo !== s.tempo ? "#cfc8be" : "#a89e8e"}
                  className="font-mono"
                  dx="6"
                >
                  {s.count}
                </tspan>
              )}
            </text>
          )}
        </g>
      ))}

      {/* inner attitude nodes */}
      {innerNodes.map(n => (
        <g key={n.inner}>
          <circle
            cx={n.ix} cy={n.iy} r={n.r}
            fill={F.INNER_COLOR[n.inner]}
            fillOpacity="0.42"
            stroke={F.INNER_COLOR[n.inner]}
            strokeWidth={isDetail ? 2.5 : 1.8}
            strokeDasharray={n.isBaseline ? null : "5,3"}
          />
          <text x={n.ix} y={n.iy + (isDetail ? 2 : 2)} textAnchor="middle"
            fontSize={isDetail ? 14 : 10}
            fontWeight="700" fill="#fff"
            className="font-sans"
            style={{ paintOrder: 'stroke', stroke: 'rgba(0,0,0,0.45)', strokeWidth: 0.8 }}
          >
            {n.inner}
          </text>
          {n.count > 0 && (
            <text x={n.ix} y={n.iy + (isDetail ? 19 : 13)} textAnchor="middle"
              fontSize={isDetail ? 11 : 9}
              fontWeight="500"
              fill="#fff"
              className="font-mono"
              style={{ paintOrder: 'stroke', stroke: 'rgba(0,0,0,0.3)', strokeWidth: 0.6 }}
            >
              {n.count}
            </text>
          )}
        </g>
      ))}

      {/* aspect nodes (inner core) */}
      {aspectNodes.map(a => (
        <g key={a.aspect}>
          <circle
            cx={a.ax} cy={a.ay} r={a.r}
            fill={F.ASPECT_COLOR[a.aspect]}
            fillOpacity="0.65"
            stroke={F.ASPECT_COLOR[a.aspect]}
            strokeWidth="1.2"
          />
          {isDetail && (
            <text x={a.ax} y={a.ay + 3} textAnchor="middle"
              fontSize="9.5" fontWeight="700" fill="#fff"
              className="font-sans"
              style={{ paintOrder: 'stroke', stroke: 'rgba(0,0,0,0.45)', strokeWidth: 0.6 }}
            >
              {a.aspect.slice(0,4).toUpperCase()}
            </text>
          )}
          {isDetail && a.count > 0 && (
            <text x={a.ax} y={a.ay + a.r + 11} textAnchor="middle"
              fontSize="10" fill="#6b6660" className="font-mono">
              {a.count}
            </text>
          )}
        </g>
      ))}

      {/* Hover tooltip showing pole + motor + dominant drive axis */}
      {hoveredSpoke && (() => {
        const det = F.TEMPO_DETAIL[hoveredSpoke.tempo];
        if (!det) return null;
        const ttX = hoveredSpoke.tx;
        const ttY = hoveredSpoke.ty;
        const rad = hoveredSpoke.ang * Math.PI / 180;
        const offX = Math.cos(rad) * 12;
        const offY = -Math.sin(rad) * 12;
        const sinA = Math.sin(rad);
        const above = sinA > 0;
        const axis = hoveredSpoke.driveAxis;
        const axisCounts = dByTempo[hoveredSpoke.tempo] || {};
        const axisTotal = Object.values(axisCounts).reduce((a,b) => a+b, 0);
        const axisCount = axis ? (axisCounts[axis] || 0) : 0;
        const boxW = 168;
        const boxH = axis ? 56 : 38;
        const bx = ttX + offX - boxW / 2;
        const by = above ? (ttY + offY - boxH - 14) : (ttY + offY + 14);
        return (
          <g style={{ pointerEvents: 'none' }}>
            <rect x={bx} y={by} width={boxW} height={boxH} rx="4"
              fill="#1a1814" fillOpacity="0.95"
              stroke={F.INNER_COLOR[hoveredSpoke.inner]} strokeOpacity="0.6" strokeWidth="1"
            />
            <text x={bx + boxW/2} y={by + 15} textAnchor="middle"
              fontSize="11" fontWeight="600" fill="#fff" className="font-mono">
              {det.pole}
            </text>
            <text x={bx + boxW/2} y={by + 29} textAnchor="middle"
              fontSize="10" fontStyle="italic" fill="#d8d1c5" className="font-mono">
              {det.motor}
            </text>
            {axis && (
              <>
                <circle cx={bx + 14} cy={by + 45} r="3.5"
                  fill={F.axisColor(axis)} stroke="#fff" strokeOpacity="0.3" strokeWidth="0.6"
                />
                <text x={bx + 22} y={by + 48} textAnchor="start"
                  fontSize="10" fontWeight="600" fill="#fff" className="font-mono">
                  {axis}
                </text>
                <text x={bx + boxW - 8} y={by + 48} textAnchor="end"
                  fontSize="9" fill="#a89e8e" className="font-mono">
                  {axisCount}/{axisTotal}
                </text>
              </>
            )}
          </g>
        );
      })()}
    </svg>
  );
}

window.Shell3 = Shell3;

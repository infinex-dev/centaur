// Mirodan 3-shell framework constants. Single source of truth.
window.LABAN = (() => {
  const INNER_COLOR = {
    Stable: "#7c3aed",
    Near:   "#dc2626",
    Adream: "#f97316",
    Awake:  "#2563eb",
    Mobile: "#10b981",
    Remote: "#06b6d4",
  };

  const ASPECT_COLOR = {
    enclosing:      "#92400e",
    penetrating:    "#1e40af",
    radiating:      "#065f46",
    circumscribing: "#4b5563",
  };

  // Angles in degrees, math-conventional (0 = right, 90 = top, ccw).
  const INNER_ANGLES = {
    Stable:  90,
    Awake:   30,
    Near:    330,
    Mobile:  270,
    Adream:  210,
    Remote:  150,
  };

  const BASELINES = new Set(["Stable", "Near", "Adream"]);

  const ASPECT_INNERS = {
    enclosing:      ["Stable", "Near", "Adream"],
    penetrating:    ["Stable", "Awake", "Remote"],
    radiating:      ["Adream", "Remote", "Mobile"],
    circumscribing: ["Near",   "Mobile", "Awake"],
  };

  // Aspect positions are computed as the CENTROID of their 3 connected
  // inner attitudes. Each aspect sits visually inside its triangle.
  function aspectCentroid(aspect, cx, cy, rInner, pullToCenter = 0.78) {
    const inners = ASPECT_INNERS[aspect];
    let sx = 0, sy = 0;
    for (const inner of inners) {
      const [x, y] = polar(INNER_ANGLES[inner], cx, cy, rInner);
      sx += x; sy += y;
    }
    sx /= inners.length; sy /= inners.length;
    // Pull slightly toward center so nodes don't crowd the inner-attitude rim.
    return [cx + (sx - cx) * pullToCenter, cy + (sy - cy) * pullToCenter];
  }

  const INNER_TEMPI = {
    Stable: ["Commanding", "Receptive", "Practical", "Self-Contained"],
    Near:   ["Materialistic", "Human", "Warm", "Cool"],
    Adream: ["Sombre", "Irradiant", "Overpowering", "Diffused"],
    Mobile: ["Unacknowledged", "Acknowledged", "Revealed", "Concealed"],
    Remote: ["Egocentric", "Altruistic", "Sociable", "Unsociable"],
    Awake:  ["Acute", "Doubting", "Certain", "Uncertain"],
  };

  const TEMPO_DETAIL = {
    Commanding:     { pole: "Strong + Direct",   motor: "pressing → punching" },
    Practical:      { pole: "Strong + Flexible", motor: "wringing → slashing" },
    Receptive:      { pole: "Light + Direct",    motor: "gliding → dabbing" },
    "Self-Contained":{ pole:"Light + Flexible",  motor: "floating → flicking" },
    Materialistic:  { pole: "Strong + Sustained",motor: "pressing → wringing" },
    Warm:           { pole: "Strong + Quick",    motor: "punching → slashing" },
    Human:          { pole: "Light + Sustained", motor: "gliding → floating" },
    Cool:           { pole: "Light + Quick",     motor: "dabbing → flicking" },
    Sombre:         { pole: "Strong + Bound",    motor: "pressing → slashing" },
    Overpowering:   { pole: "Strong + Free",     motor: "pressing → punching" },
    Diffused:       { pole: "Light + Bound",     motor: "gliding → floating" },
    Irradiant:      { pole: "Light + Free",      motor: "floating → flicking" },
    Unacknowledged: { pole: "Sustained + Bound", motor: "pressing → floating" },
    Acknowledged:   { pole: "Sustained + Free",  motor: "gliding → flicking" },
    Revealed:       { pole: "Quick + Free",      motor: "punching → flicking" },
    Concealed:      { pole: "Quick + Bound",     motor: "slashing → dabbing" },
    Egocentric:     { pole: "Direct + Bound",    motor: "pressing → gliding" },
    Altruistic:     { pole: "Direct + Free",     motor: "dabbing → floating" },
    Sociable:       { pole: "Flexible + Free",   motor: "slashing → flicking" },
    Unsociable:     { pole: "Flexible + Bound",  motor: "wringing → floating" },
    Acute:          { pole: "Direct + Quick",    motor: "punching → dabbing" },
    Doubting:       { pole: "Flexible + Quick",  motor: "slashing → flicking" },
    Certain:        { pole: "Direct + Sustained",motor: "pressing → gliding" },
    Uncertain:      { pole: "Flexible + Sustained", motor: "wringing → floating" },
  };

  const INNER_DESCRIPTOR = {
    Stable: "Weight + Space",
    Near:   "Weight + Time",
    Adream: "Weight + Flow",
    Awake:  "Space + Time",
    Mobile: "Time + Flow",
    Remote: "Space + Flow",
  };

  const ASPECT_DESCRIPTOR = {
    enclosing:      "Weight-led",
    penetrating:    "Space-led",
    radiating:      "Flow-led",
    circumscribing: "Time-led",
  };

  const STRESS_TRIANGLES = [
    { baselines: ["Stable", "Near"],   action: "Awake"  },
    { baselines: ["Stable", "Adream"], action: "Remote" },
    { baselines: ["Near",   "Adream"], action: "Mobile" },
  ];

  const INNER_EDGES = [
    ["Stable","Awake"], ["Stable","Remote"],
    ["Near","Awake"],   ["Near","Mobile"],
    ["Adream","Mobile"],["Adream","Remote"],
  ];

  function polar(angleDeg, cx, cy, r) {
    const rad = angleDeg * Math.PI / 180;
    return [cx + r * Math.cos(rad), cy - r * Math.sin(rad)];
  }

  // ─── Drive layer (Mirodan X-diagram) ──────────────────────────────────
  // 4 base drives = 3-of-4 motion factors active, named by the LATENT factor.
  // Each placement's Main Character-Action Axis = primary (bottom-left of X)
  // → extravert (top-right of X). Spoke colors render the EXTRAVERT side =
  // where the placement projects to ("destination"). Vision-destination is
  // the structural pattern across the corpus (see HANDOVER 2026-05-18 §H).
  const DRIVE_COLOR = {
    doing:   "#3b82f6",
    spell:   "#10b981",
    passion: "#ef4444",
    vision:  "#a855f7",
    unknown: "#d1d5db",
  };

  // Canonical render order for fingerprint drive-axis row. Vision-destination
  // axes first (empirically dominant), then Passion-destination, then others.
  const DRIVE_AXIS_ORDER = [
    "doing→vision",
    "passion→vision",
    "spell→vision",
    "spell→passion",
    "doing→passion",
    "passion→spell",
    "passion→doing",
    "doing→spell",
    "spell→doing",
    "vision→doing",
    "vision→spell",
    "vision→passion",
  ];

  function axisDestination(axis) {
    if (!axis || typeof axis !== "string" || !axis.includes("→")) return null;
    return axis.split("→")[1];
  }

  function axisColor(axis) {
    const dest = axisDestination(axis);
    return (dest && DRIVE_COLOR[dest]) || DRIVE_COLOR.unknown;
  }

  function dominantAxis(driveAxisCounts) {
    if (!driveAxisCounts) return null;
    let best = null, bestCount = 0;
    for (const [axis, count] of Object.entries(driveAxisCounts)) {
      if (count > bestCount) { best = axis; bestCount = count; }
    }
    return best;
  }

  return {
    INNER_COLOR, ASPECT_COLOR, INNER_ANGLES,
    BASELINES, ASPECT_INNERS, INNER_TEMPI, TEMPO_DETAIL,
    INNER_DESCRIPTOR, ASPECT_DESCRIPTOR, STRESS_TRIANGLES, INNER_EDGES,
    DRIVE_COLOR, DRIVE_AXIS_ORDER,
    polar, aspectCentroid, axisDestination, axisColor, dominantAxis,
    INNER_ORDER: ["Stable","Awake","Near","Mobile","Adream","Remote"],
  };
})();

function seededRandom(seed) {
  return function () {
    seed = (seed + 0x6D2B79F5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function fir(x, ground, height, cls) {
  let form = `<rect class="${cls}" x="${x - height * 0.03}" y="${ground - height * 0.14}" width="${height * 0.06}" height="${height * 0.14}"/>`;
  for (let i = 0; i < 3; i++) {
    const bottom = ground - height * 0.12 - i * height * 0.26;
    const top = Math.max(bottom - height * 0.5, ground - height);
    const width = height * 0.42 * (1 - i * 0.25);
    form += `<polygon class="${cls}" points="${x - width},${bottom} ${x},${top} ${x + width},${bottom}"/>`;
  }
  return form;
}

function leafTree(x, ground, height, cls) {
  const r = height * 0.28;
  return `<rect class="${cls}" x="${x - height * 0.035}" y="${ground - height * 0.45}" width="${height * 0.07}" height="${height * 0.45}"/>
    <circle class="${cls}" cx="${x}" cy="${ground - height + r}" r="${r}"/>
    <circle class="${cls}" cx="${x - r * 0.8}" cy="${ground - height * 0.55}" r="${r * 0.85}"/>
    <circle class="${cls}" cx="${x + r * 0.8}" cy="${ground - height * 0.55}" r="${r * 0.85}"/>`;
}

function forestArt(seed) {
  const rand = seededRandom(seed);
  const between = (a, b) => a + rand() * (b - a);

  const treeRow = (counts, fromX, toX, ground, hMin, hMax, cls, leafShare) => {
    let part = "";
    for (let i = 0; i < counts; i++) {
      const x = fromX + (i + between(0.15, 0.85)) * (toX - fromX) / counts;
      const h = between(hMin, hMax);
      const y = ground + between(-5, 5);
      part += rand() < leafShare ? leafTree(x, y, h, cls) : fir(x, y, h, cls);
    }
    return part;
  };

  let rays = "";
  for (let i = 0; i < 6; i++) {
    const bottom = 50 + i * 60 + between(-12, 12);
    rays += `<polygon class="ray" points="${188 + i * 5},0 ${206 + i * 5},0 ${bottom + 20},260 ${bottom - 20},260"/>`;
  }

  let fireflies = "";
  for (let i = 0; i < 14; i++) {
    fireflies += `<circle class="firefly" cx="${between(20, 380)}" cy="${between(120, 250)}" r="${between(1.2, 2.4)}" style="animation-delay:${between(0, 3.4)}s"/>`;
  }

  return `
    <figure class="forest-art">
      <svg viewBox="0 0 400 260" role="img" aria-label="Ein Waldweg führt zwischen alten Bäumen ins Licht">
        <defs>
          <linearGradient id="sky-${seed}" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" class="sky-top"/><stop offset="1" class="sky-bottom"/>
          </linearGradient>
          <radialGradient id="glow-${seed}">
            <stop offset="0" class="glow-center"/><stop offset="1" class="glow-edge"/>
          </radialGradient>
        </defs>
        <rect width="400" height="260" fill="url(#sky-${seed})"/>
        <circle cx="200" cy="110" r="120" fill="url(#glow-${seed})"/>
        ${rays}
        ${treeRow(14, -20, 420, 205, 55, 95, "tree-back", 0.4)}
        <path class="ground" d="M0,214 Q100,202 200,211 T400,208 L400,260 L0,260 Z"/>
        ${treeRow(5, -20, 160, 232, 95, 145, "tree-mid", 0.3)}
        ${treeRow(5, 240, 420, 232, 95, 145, "tree-mid", 0.3)}
        <path class="path" d="M195,211 L205,211 Q232,230 262,260 L138,260 Q176,232 195,211 Z"/>
        ${treeRow(2, -40, 90, 272, 175, 225, "tree-front", 0)}
        ${treeRow(2, 310, 440, 272, 175, 225, "tree-front", 0)}
        ${fireflies}
      </svg>
    </figure>`;
}

function adventureArt(id, small) {
  if (id === "forest") return small ? `<span class="adventure-art adventure-art-forest"></span>` : "";
  if (id === "tavern") return small ? `<span class="adventure-art">${tavernArt(true)}</span>` : `<figure class="tavern-art">${tavernArt(false)}</figure>`;
  const seed = [...id].reduce((s, z) => s + z.charCodeAt(0), 0);
  return small ? `<span class="adventure-art adventure-art-drawn">${forestArt(seed)}</span>` : `<figure class="tavern-art">${forestArt(seed)}</figure>`;
}

function tavernArt(cropped) {
  let planks = "";
  for (let x = 0; x <= 400; x += 34) planks += `<line class="plank" x1="${x}" y1="0" x2="${x}" y2="205"/>`;
  let rain = "";
  for (let i = 0; i < 26; i++) {
    const x = 30 + (i * 37) % 140, y = 20 + (i * 53) % 150;
    rain += `<line x1="${x}" y1="${y}" x2="${x - 5}" y2="${y + 14}"/>`;
  }
  return `
    <svg viewBox="0 0 400 260" ${cropped ? 'preserveAspectRatio="xMidYMid slice"' : ""} role="img" aria-label="Eine Taverne bei Nacht: Sturm vor dem Fenster, ein Feuer im Kamin, Krüge und eine Kerze auf dem Tisch">
      <defs>
        <radialGradient id="ember-glow">
          <stop offset="0" class="ember-center"/><stop offset="1" class="ember-edge"/>
        </radialGradient>
        <clipPath id="window-clip"><rect x="44" y="44" width="102" height="112"/></clipPath>
      </defs>
      <rect class="wall" width="400" height="260"/>
      ${planks}
      <circle cx="310" cy="170" r="150" fill="url(#ember-glow)"/>
      <circle cx="232" cy="185" r="60" fill="url(#ember-glow)"/>

      <!-- window with storm -->
      <rect class="night" x="44" y="44" width="102" height="112"/>
      <g clip-path="url(#window-clip)">
        <polyline class="lightning" points="112,44 98,86 110,88 92,140"/>
        <g class="rain">${rain}</g>
      </g>
      <rect class="window-frame" x="40" y="40" width="110" height="120"/>
      <line class="window-frame" x1="95" y1="40" x2="95" y2="160"/>
      <line class="window-frame" x1="40" y1="100" x2="150" y2="100"/>

      <!-- fireplace -->
      <rect class="stone" x="252" y="70" width="124" height="135"/>
      <rect class="mantel" x="244" y="64" width="140" height="12"/>
      <path class="hearth" d="M270 205 V140 Q314 104 358 140 V205 Z"/>
      <g class="fire">
        <path class="flame flame-a" d="M292 205 Q286 178 300 160 Q302 180 312 182 Q316 166 326 156 Q340 182 334 205 Z"/>
        <path class="flame-inner flame-b" d="M302 205 Q300 188 310 176 Q314 190 320 188 Q326 196 324 205 Z"/>
      </g>

      <!-- table -->
      <rect class="table" x="0" y="205" width="400" height="55"/>
      <line class="table-edge" x1="0" y1="207" x2="400" y2="207"/>

      <!-- mugs -->
      <g class="mug">
        <path class="handle" d="M150 182 Q166 182 166 196 Q166 208 150 206"/>
        <rect x="120" y="170" width="32" height="40" rx="3"/>
        <ellipse class="foam" cx="136" cy="170" rx="18" ry="6"/>
      </g>
      <g class="mug">
        <path class="handle" d="M186 186 Q172 186 172 198 Q172 210 186 208"/>
        <rect x="184" y="176" width="28" height="34" rx="3"/>
        <ellipse class="foam" cx="198" cy="176" rx="16" ry="5"/>
      </g>

      <!-- candle -->
      <rect class="candle" x="226" y="182" width="12" height="28" rx="2"/>
      <ellipse class="candle-flame" cx="232" cy="174" rx="4" ry="8"/>
    </svg>`;
}

function icon(name) {
  const shapes = {
    coin: `<circle cx="20" cy="20" r="14"/><circle cx="20" cy="20" r="9"/>`,
    event: `<rect x="11" y="5" width="18" height="30" rx="3"/><path class="filled" d="M20 13 l2 4.2 4.6 .6 -3.3 3.2 .8 4.6 -4.1 -2.2 -4.1 2.2 .8 -4.6 -3.3 -3.2 4.6 -.6z"/>`,
    minigame: `<rect x="8" y="8" width="24" height="24" rx="5"/><circle class="filled" cx="14.5" cy="14.5" r="2"/><circle class="filled" cx="20" cy="20" r="2"/><circle class="filled" cx="25.5" cy="25.5" r="2"/>`,
    ability: `<path d="M20 4 L23.5 16.5 L36 20 L23.5 23.5 L20 36 L16.5 23.5 L4 20 L16.5 16.5 Z"/>`,
    guess: `<path d="M4 20 C10 10.5 30 10.5 36 20 C30 29.5 10 29.5 4 20 Z"/><circle cx="20" cy="20" r="5"/><circle class="filled" cx="20" cy="20" r="2"/>`,
    role: `<rect x="9" y="5" width="22" height="30" rx="3"/><circle cx="20" cy="16" r="4.5"/><path d="M13.5 29 C14.5 22.5 25.5 22.5 26.5 29"/>`,
    roles: `<rect x="5" y="10" width="15" height="21" rx="2" transform="rotate(-12 12.5 20.5)"/><rect x="20" y="10" width="15" height="21" rx="2" transform="rotate(12 27.5 20.5)"/><rect x="12.5" y="7" width="15" height="23" rx="2" style="fill: var(--card)"/>`,
    lightning: `<path d="M22 4 L11 22 H19 L17 36 L29 16 H21 Z"/>`,
    gear: `<circle cx="20" cy="20" r="5"/><path d="M20 5v5M20 30v5M35 20h-5M10 20H5M30.6 9.4l-3.5 3.5M12.9 27.1l-3.5 3.5M30.6 30.6l-3.5-3.5M12.9 12.9L9.4 9.4"/>`,
    flag: `<path d="M11 35 V6"/><path d="M11 7 C17 3 22 11 30 7 V21 C22 25 17 17 11 21"/>`,
    rules: `<path d="M20 11 C15 8 10 8 6 9 V31 C10 30 15 30 20 33 C25 30 30 30 34 31 V9 C30 8 25 8 20 11 Z M20 11 V33"/>`
  };
  return `<svg viewBox="0 0 40 40" aria-hidden="true">${shapes[name]}</svg>`;
}

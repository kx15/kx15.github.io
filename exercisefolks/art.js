// ExerciseFolks village art: original, hand-built isometric SVG pieces.
// Every item is drawn around (0,0) = the centre of its ground tile, with
// "up" as negative y. Nothing here imitates an existing game.
(function () {
  const TW = 64, TH = 32; // tile footprint on screen

  const C = {
    wallTop: '#FFF4E4', wallL: '#F7E2C8', wallR: '#EBCDAA',
    roofL: '#EE9C8A', roofR: '#DB8170',
    wood: '#D9A87A', woodDark: '#B98A60',
    leaf1: '#A9D3A0', leaf2: '#93C48C', leaf3: '#BFE0B2',
    pine1: '#86BFA0', pine2: '#71AE8E',
    water: '#A9D4F0', waterHi: '#DDF0FB',
    butter: '#FFE39A', glow: '#FFD36B',
    rose: '#F4A6B7', lilac: '#CDB8EE', peach: '#FFC6A8', sky: '#BFDDF2',
    stone: '#D8D2CC', stoneDark: '#BDB5AE', soil: '#B88E6C', ink: '#5B4B63',
  };

  const pts = (arr) => arr.map((p) => p[0].toFixed(1) + ',' + p[1].toFixed(1)).join(' ');
  const poly = (arr, fill, extra = '') => `<polygon points="${pts(arr)}" fill="${fill}" ${extra}/>`;

  // An isometric box: footprint half-extents a (x) and b (y), height h.
  function box(a, b, h, top, left, right, lift = 0) {
    const y = -lift;
    return (
      poly([[-a, y], [0, y + b], [0, y + b - h], [-a, y - h]], left) +
      poly([[0, y + b], [a, y], [a, y - h], [0, y + b - h]], right) +
      poly([[0, y - b - h], [a, y - h], [0, y + b - h], [-a, y - h]], top)
    );
  }
  // Pyramid roof sitting on a box of height h.
  function roof(a, b, h, rise, left, right, over = 4) {
    const A = a + over, B = b + over / 2;
    const apex = [0, -h - rise];
    return (
      poly([[-A, -h], [0, B - h], apex], left) +
      poly([[0, B - h], [A, -h], apex], right)
    );
  }
  // A point on the left / right visible face of a box (u along the face 0..1, v = height).
  const onL = (a, b, u, v) => [-a + u * a, u * b - v];
  const onR = (a, b, u, v) => [u * a, b - u * b - v];
  function faceQuad(on, a, b, u0, u1, v0, v1, fill, extra = '') {
    return poly([on(a, b, u0, v0), on(a, b, u1, v0), on(a, b, u1, v1), on(a, b, u0, v1)], fill, extra);
  }
  const shadow = (rx = 22, ry = 9) => `<ellipse cx="0" cy="2" rx="${rx}" ry="${ry}" fill="#000" opacity=".08"/>`;

  const ART = {
    cottage() {
      const a = 20, b = 10, h = 22;
      return shadow(26, 12) + box(a, b, h, C.wallTop, C.wallL, C.wallR) +
        faceQuad(onL, a, b, 0.35, 0.65, 0, 13, C.woodDark) +
        `<circle cx="${onL(a, b, 0.58, 6)[0]}" cy="${onL(a, b, 0.58, 6)[1]}" r="1" fill="${C.butter}"/>` +
        faceQuad(onR, a, b, 0.3, 0.7, 8, 17, C.butter, 'class="glow-window"') +
        roof(a, b, h, 22, C.roofL, C.roofR) +
        `<rect x="6" y="${-h - 20}" width="5" height="9" rx="1" fill="${C.stoneDark}"/>`;
    },
    tree() {
      return shadow(16, 7) +
        `<rect x="-2.5" y="-16" width="5" height="16" rx="2" fill="${C.woodDark}"/>` +
        `<g class="sway"><circle cx="0" cy="-30" r="15" fill="${C.leaf2}"/>` +
        `<circle cx="-8" cy="-24" r="10" fill="${C.leaf1}"/><circle cx="8" cy="-26" r="10" fill="${C.leaf1}"/>` +
        `<circle cx="-3" cy="-36" r="7" fill="${C.leaf3}"/></g>`;
    },
    pine() {
      return shadow(13, 6) +
        `<rect x="-2" y="-10" width="4" height="10" fill="${C.woodDark}"/>` +
        `<g class="sway">${poly([[-14, -10], [14, -10], [0, -30]], C.pine2)}${poly([[-11, -22], [11, -22], [0, -40]], C.pine1)}${poly([[-8, -33], [8, -33], [0, -48]], C.pine2)}</g>`;
    },
    flowers() {
      const dots = [[-10, -1, C.rose], [-4, 3, C.butter], [3, -2, C.lilac], [9, 2, C.rose], [0, 6, C.peach], [-6, -5, C.lilac], [6, -6, C.butter]];
      return `<ellipse cx="0" cy="1" rx="17" ry="8" fill="${C.leaf1}" opacity=".9"/>` +
        dots.map(([x, y, c]) => `<circle cx="${x}" cy="${y - 2}" r="2.6" fill="${c}"/><circle cx="${x}" cy="${y - 2}" r=".9" fill="#fff8"/>`).join('');
    },
    lantern() {
      return shadow(7, 3) +
        `<rect x="-1.2" y="-30" width="2.4" height="30" fill="${C.ink}" opacity=".75"/>` +
        `<circle cx="0" cy="-34" r="11" fill="${C.glow}" opacity=".35" class="pulse"/>` +
        `<rect x="-5" y="-40" width="10" height="11" rx="3" fill="${C.butter}" stroke="${C.ink}" stroke-opacity=".5"/>` +
        poly([[-6, -40], [6, -40], [0, -45]], C.ink, 'opacity=".7"');
    },
    garden() {
      const a = 22, b = 11;
      let rows = '';
      for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) {
        const x = -a + 11 + i * 11 - j * 6 + 6, y = -9 + j * 5 + i * 1.2 - 3;
        rows += `<circle cx="${x}" cy="${y}" r="3" fill="${j % 2 ? C.leaf2 : C.leaf1}"/>`;
      }
      return box(a, b, 5, C.soil, C.wood, C.woodDark) + rows +
        `<circle cx="-4" cy="-10" r="2" fill="${C.rose}"/><circle cx="9" cy="-6" r="2" fill="${C.peach}"/>`;
    },
    bench() {
      const a = 14, b = 7;
      return shadow(16, 6) +
        `<rect x="-11" y="-8" width="2" height="8" fill="${C.woodDark}"/><rect x="9" y="-8" width="2" height="8" fill="${C.woodDark}"/>` +
        box(a, b, 3, C.wood, C.woodDark, C.woodDark, 8) +
        poly([[-a, -14], [0, b - 14], [0, b - 20], [-a, -20]], C.wood);
    },
    cat() {
      return shadow(10, 4) +
        `<ellipse cx="0" cy="-6" rx="9" ry="6" fill="${C.peach}"/>` +
        `<path d="M8 -6 q8 -2 6 -12" stroke="${C.peach}" stroke-width="3" fill="none" stroke-linecap="round" class="tail"/>` +
        `<circle cx="-7" cy="-13" r="5.5" fill="${C.peach}"/>` +
        poly([[-12, -15], [-10, -22], [-7, -17]], C.peach) + poly([[-6, -17], [-3, -22], [-2, -14]], C.peach) +
        `<circle cx="-9" cy="-13" r=".9" fill="${C.ink}"/><circle cx="-5.5" cy="-13" r=".9" fill="${C.ink}"/>` +
        `<ellipse cx="-7" cy="-11" rx="1.3" ry=".8" fill="${C.rose}"/>`;
    },
    dog() {
      return shadow(12, 5) +
        `<ellipse cx="1" cy="-7" rx="10" ry="6.5" fill="${C.wood}"/>` +
        `<rect x="-6" y="-4" width="3" height="5" rx="1.5" fill="${C.woodDark}"/><rect x="5" y="-4" width="3" height="5" rx="1.5" fill="${C.woodDark}"/>` +
        `<path d="M10 -9 q6 -4 5 -9" stroke="${C.wood}" stroke-width="3" fill="none" stroke-linecap="round" class="tail"/>` +
        `<circle cx="-8" cy="-14" r="6" fill="${C.wood}"/>` +
        `<ellipse cx="-12.5" cy="-13" rx="2.2" ry="4" fill="${C.woodDark}"/><ellipse cx="-3.5" cy="-13" rx="2.2" ry="4" fill="${C.woodDark}"/>` +
        `<circle cx="-10" cy="-15" r=".9" fill="${C.ink}"/><circle cx="-6" cy="-15" r=".9" fill="${C.ink}"/>` +
        `<ellipse cx="-8" cy="-11.5" rx="1.6" ry="1.1" fill="${C.ink}"/>`;
    },
    pond() {
      return `<ellipse cx="0" cy="0" rx="26" ry="12" fill="${C.stone}"/>` +
        `<ellipse cx="0" cy="0" rx="22" ry="9.5" fill="${C.water}"/>` +
        `<ellipse cx="-7" cy="-2" rx="7" ry="2" fill="${C.waterHi}" class="shimmer"/>` +
        `<ellipse cx="8" cy="3" rx="4" ry="1.2" fill="${C.waterHi}" class="shimmer delay"/>` +
        `<ellipse cx="10" cy="-3" rx="4" ry="2" fill="${C.leaf1}"/><circle cx="11" cy="-4" r="1.3" fill="${C.rose}"/>`;
    },
    cafe() {
      const a = 24, b = 12, h = 24;
      let stripes = '';
      for (let i = 0; i < 6; i++) {
        const u0 = i / 6, u1 = (i + 1) / 6;
        stripes += poly([onR(a, b, u0, 19), onR(a, b, u1, 19), [onR(a, b, u1, 19)[0] + 3, onR(a, b, u1, 19)[1] + 7], [onR(a, b, u0, 19)[0] + 3, onR(a, b, u0, 19)[1] + 7]], i % 2 ? '#fff' : C.rose);
      }
      return shadow(30, 13) + box(a, b, h, C.wallTop, '#F9E9D8', '#EED6BE') +
        faceQuad(onL, a, b, 0.4, 0.7, 0, 14, C.woodDark) +
        faceQuad(onR, a, b, 0.15, 0.85, 4, 15, C.butter, 'class="glow-window"') +
        stripes + roof(a, b, h, 14, C.lilac, '#B9A1E0', 3) +
        `<text x="-14" y="${-h - 1}" font-size="6" font-family="Fredoka, sans-serif" fill="${C.ink}" transform="rotate(-26 -14 ${-h})">café</text>` +
        `<g transform="translate(30 6)"><ellipse cx="0" cy="0" rx="6" ry="3" fill="#000" opacity=".07"/><rect x="-.8" y="-14" width="1.6" height="14" fill="${C.ink}" opacity=".6"/><path d="M-9 -13 Q0 -21 9 -13 Z" fill="${C.rose}"/></g>`;
    },
    fountain() {
      return `<ellipse cx="0" cy="0" rx="22" ry="10" fill="${C.stoneDark}"/>` +
        `<ellipse cx="0" cy="-3" rx="22" ry="10" fill="${C.stone}"/>` +
        `<ellipse cx="0" cy="-3" rx="18" ry="7.5" fill="${C.water}"/>` +
        `<rect x="-3" y="-20" width="6" height="16" fill="${C.stone}"/>` +
        `<ellipse cx="0" cy="-20" rx="9" ry="4" fill="${C.stoneDark}"/><ellipse cx="0" cy="-21" rx="8" ry="3" fill="${C.water}"/>` +
        `<g class="spray"><circle cx="0" cy="-27" r="1.6" fill="${C.waterHi}"/><circle cx="-4" cy="-24" r="1.2" fill="${C.waterHi}"/><circle cx="4" cy="-24" r="1.2" fill="${C.waterHi}"/></g>`;
    },
    gazebo() {
      const posts = [[-16, -2], [16, -2], [-6, 6], [6, 6]];
      return shadow(24, 11) + `<ellipse cx="0" cy="0" rx="22" ry="10" fill="${C.wallTop}"/>` +
        posts.map(([x, y]) => `<rect x="${x - 1.5}" y="${y - 24}" width="3" height="24" fill="#fff" stroke="${C.wallR}"/>`).join('') +
        poly([[-24, -24], [0, -14], [0, -44]], C.lilac) + poly([[0, -14], [24, -24], [0, -44]], '#B9A1E0') +
        `<circle cx="0" cy="-45" r="2.2" fill="${C.butter}"/>` +
        `<path d="M-16 -22 q4 4 8 0 q4 4 8 0" stroke="${C.butter}" stroke-width="1.5" fill="none" class="pulse"/>`;
    },
    hotspring() {
      const rocks = [[-20, -1], [-12, 6], [0, 9], [12, 6], [20, -1], [12, -7], [-12, -7], [0, -9]];
      return `<ellipse cx="0" cy="0" rx="24" ry="11" fill="${C.water}"/>` +
        `<ellipse cx="0" cy="0" rx="17" ry="7" fill="#C6E6F6"/>` +
        rocks.map(([x, y], i) => `<ellipse cx="${x}" cy="${y}" rx="${5 + (i % 2)}" ry="3.5" fill="${i % 3 ? C.stone : C.stoneDark}"/>`).join('') +
        `<g class="steam" fill="none" stroke="#fff" stroke-width="2.2" stroke-linecap="round" opacity=".8">` +
        `<path d="M-7 -6 q-4 -6 0 -12 q4 -6 0 -12"/><path d="M5 -4 q-4 -6 0 -12 q4 -6 0 -12" class="delay"/></g>`;
    },
    swing() {
      return shadow(20, 8) +
        `<rect x="-18" y="-34" width="3" height="34" fill="${C.woodDark}"/><rect x="15" y="-34" width="3" height="34" fill="${C.woodDark}"/>` +
        `<rect x="-19" y="-36" width="38" height="4" rx="2" fill="${C.wood}"/>` +
        `<g class="swinging"><line x1="-6" y1="-32" x2="-6" y2="-10" stroke="${C.ink}" stroke-opacity=".5"/><line x1="6" y1="-32" x2="6" y2="-10" stroke="${C.ink}" stroke-opacity=".5"/>` +
        `<rect x="-8" y="-11" width="16" height="3" rx="1.5" fill="${C.rose}"/></g>`;
    },
    bakery() {
      const a = 18, b = 9, h = 26;
      return shadow(24, 11) + box(a, b, h, '#FFF8EE', '#FCE9DC', '#F2D5C2') +
        faceQuad(onL, a, b, 0.3, 0.62, 0, 13, C.woodDark) +
        faceQuad(onR, a, b, 0.25, 0.75, 9, 18, C.butter, 'class="glow-window"') +
        roof(a, b, h, 18, C.peach, '#F0A988') +
        `<rect x="7" y="${-h - 18}" width="5" height="10" rx="1" fill="${C.stoneDark}"/>` +
        `<g class="steam" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" opacity=".85"><path d="M9.5 ${-h - 20} q-3 -5 0 -10 q3 -5 0 -10"/></g>` +
        `<ellipse cx="${onR(a, b, 0.5, 21)[0]}" cy="${onR(a, b, 0.5, 21)[1]}" rx="5" ry="2.4" fill="${C.wood}"/>`;
    },
  };

  // Shop catalogue. `level` = village level that unlocks the item.
  const VILLAGE_ITEMS = [
    { id: 'flowers', name: 'Flower patch', price: 30, level: 1 },
    { id: 'lantern', name: 'Lantern', price: 40, level: 1 },
    { id: 'tree', name: 'Round tree', price: 50, level: 1 },
    { id: 'bench', name: 'Bench', price: 60, level: 1 },
    { id: 'garden', name: 'Veggie garden', price: 80, level: 1 },
    { id: 'cottage', name: 'Cottage', price: 200, level: 1 },
    { id: 'pine', name: 'Pine tree', price: 60, level: 2 },
    { id: 'cat', name: 'Village cat', price: 100, level: 2 },
    { id: 'dog', name: 'Village dog', price: 110, level: 2 },
    { id: 'pond', name: 'Pond', price: 150, level: 2 },
    { id: 'swing', name: 'Swing', price: 140, level: 3 },
    { id: 'fountain', name: 'Fountain', price: 220, level: 3 },
    { id: 'cafe', name: 'Café', price: 350, level: 3 },
    { id: 'gazebo', name: 'Gazebo', price: 300, level: 4 },
    { id: 'bakery', name: 'Bakery', price: 380, level: 4 },
    { id: 'hotspring', name: 'Hot spring', price: 500, level: 5 },
  ];

  // Points the group has earned together -> village level.
  const LEVELS = [0, 400, 1200, 2500, 5000];

  function tileToScreen(x, y) {
    return [(x - y) * TW / 2, (x + y) * TH / 2];
  }

  function itemSVG(id) { return (ART[id] || ART.flowers)(); }

  // A tiny standalone preview of one item for shop cards.
  function itemIcon(id, size = 64) {
    return `<svg viewBox="-34 -56 68 68" width="${size}" height="${size}" aria-hidden="true">` +
      `<polygon points="0,-12 30,3 0,18 -30,3" fill="#DCEFC9" transform="translate(0,-4) scale(.85)"/>${itemSVG(id)}</svg>`;
  }

  // The full village. `placed` = [{id, item_id, x, y}], `sel` = selected placed id.
  function villageSVG({ size, placed, sel = null, placing = false, interactive = true }) {
    const minX = -size * TW / 2 - 6, maxX = size * TW / 2 + 6;
    const minY = -90, maxY = size * TH + 10;
    let tiles = '';
    for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
      const [sx, sy] = tileToScreen(x, y);
      const fill = (x + y) % 2 ? '#D4EBC2' : '#DCEFC9';
      tiles += `<polygon class="tile${placing ? ' placing' : ''}" data-x="${x}" data-y="${y}" points="${pts([[sx, sy], [sx + TW / 2, sy + TH / 2], [sx, sy + TH], [sx - TW / 2, sy + TH / 2]])}" fill="${fill}" stroke="#C3DFAE" stroke-width="1"/>`;
    }
    // soft island edge
    const [lx, ly] = tileToScreen(0, size), [rx, ry] = tileToScreen(size, 0), [bx, by] = tileToScreen(size, size);
    const edge = poly([[lx, ly], [bx, by], [bx, by + 10], [lx, ly + 10]], '#C9A98A') + poly([[bx, by], [rx, ry], [rx, ry + 10], [bx, by + 10]], '#B8977A');

    const items = placed.filter((p) => p.x != null && p.x < size && p.y < size)
      .sort((p, q) => (p.x + p.y) - (q.x + q.y) || p.x - q.x)
      .map((p) => {
        const [sx, sy] = tileToScreen(p.x, p.y);
        const cls = 'item' + (p.id === sel ? ' selected' : '');
        return `<g class="${cls}" data-placed="${p.id}" transform="translate(${sx} ${sy + TH / 2}) scale(1.3)">${p.id === sel ? `<ellipse cx="0" cy="0" rx="30" ry="14" fill="none" stroke="#fff" stroke-width="2.5" stroke-dasharray="5 4" class="sel-ring"/>` : ''}${itemSVG(p.item_id)}</g>`;
      }).join('');

    return `<svg class="village${interactive ? ' interactive' : ''}" viewBox="${minX} ${minY} ${maxX - minX} ${maxY - minY}" role="img" aria-label="Your group's village">` +
      `<defs><radialGradient id="sun" cx="50%" cy="0%" r="80%"><stop offset="0" stop-color="#FFF3D6"/><stop offset="1" stop-color="#FFF3D6" stop-opacity="0"/></radialGradient></defs>` +
      `<rect x="${minX}" y="${minY}" width="${maxX - minX}" height="${maxY - minY}" fill="url(#sun)"/>` +
      edge + tiles + items + `</svg>`;
  }

  window.EFArt = { VILLAGE_ITEMS, LEVELS, villageSVG, itemIcon };
})();

import { themes, pickTile } from './themes.js';

export class GameMap {
  /**
   * @param {number} width     - largura do mapa em tiles
   * @param {number} height    - altura do mapa em tiles
   * @param {number} maxRooms  - número máximo de salas (MVP: 6 no nível 1)
   * @param {string} themeName - tema visual da fase (definido em themes.js)
   *                             Valores disponíveis: 'cave', 'catacomb', 'frozenHell'
   */
  constructor(width = 32, height = 32, maxRooms = 6, themeName = 'cave') {
    this.width    = width;
    this.height   = height;
    this.maxRooms = maxRooms;

    // Carrega o tema — define quais tiles do tileset serão usados
    // Para trocar a aparência da fase, mude o themeName no main.js
    this.theme = themes[themeName] ?? themes['cave'];

    // Grid interno: 0 = chão, 1 = parede, 2 = corredor
    // Esses valores são apenas lógicos — a aparência visual é definida pelo tema
    this.grid  = [];
    this.rooms = [];

    /**
     * Grid de visibilidade — controla a névoa de guerra.
     *   'hidden'  → fora do campo de visão atual
     *   'visible' → dentro do campo de visão atual
     */
    this.visibility = [];

    /**
     * Grid visual — índices de tile sorteados UMA VEZ na geração.
     * Guardados aqui para não re-sortear a cada renderização,
     * o que causaria tiles piscando a cada movimento do jogador.
     */
    this.visualGrid = [];

    this.generateEmpty();
    this.generate();
    this._initVisibility();
    this._buildVisualGrid();
  }

  // ---------------------------------------------------------------------------
  // Geração
  // ---------------------------------------------------------------------------

  /** Inicializa todo o grid como parede */
  generateEmpty() {
    for (let y = 0; y < this.height; y++) {
      this.grid[y] = [];
      for (let x = 0; x < this.width; x++) {
        this.grid[y][x] = 1;
      }
    }
  }

  /** Orquestra a geração completa */
  generate() {
    this.rooms = [];

    const MIN_SIZE     = 4;
    const MAX_SIZE     = 8;
    const MAX_ATTEMPTS = 150;

    // 1. Posiciona as salas sem sobreposição
    for (let i = 0; i < this.maxRooms; i++) {
      let placed   = false;
      let attempts = 0;

      while (!placed && attempts < MAX_ATTEMPTS) {
        attempts++;

        const w = randomInt(MIN_SIZE, MAX_SIZE);
        const h = randomInt(MIN_SIZE, MAX_SIZE);
        const x = randomInt(1, this.width  - w - 1);
        const y = randomInt(1, this.height - h - 1);

        const candidate = { x, y, w, h };

        if (!this.overlapsAny(candidate)) {
          this.carveRoom(candidate);
          this.rooms.push(candidate);
          placed = true;
        }
      }
    }

    // 2. Conecta TODAS as salas via MST (garante acessibilidade total)
    this.connectRoomsWithMST();
  }

  // ---------------------------------------------------------------------------
  // Conexão por MST (Prim)
  // ---------------------------------------------------------------------------

  /**
   * Árvore Geradora Mínima usando distância entre centros como peso.
   * Garante que todas as salas são alcançáveis com o mínimo de corredores.
   */
  connectRoomsWithMST() {
    if (this.rooms.length < 2) return;

    const inTree  = new Set([0]);
    const pending = new Set(this.rooms.map((_, i) => i).slice(1));

    while (pending.size > 0) {
      let bestA    = -1;
      let bestB    = -1;
      let bestDist = Infinity;

      for (const a of inTree) {
        for (const b of pending) {
          const dist = roomDistance(this.rooms[a], this.rooms[b]);
          if (dist < bestDist) {
            bestDist = dist;
            bestA    = a;
            bestB    = b;
          }
        }
      }

      this.carveCorridorBetweenRooms(this.rooms[bestA], this.rooms[bestB]);
      inTree.add(bestB);
      pending.delete(bestB);
    }
  }

  // ---------------------------------------------------------------------------
  // Escavação
  // ---------------------------------------------------------------------------

  /** Escava o interior de uma sala */
  carveRoom({ x, y, w, h }) {
    for (let row = y; row < y + h; row++) {
      for (let col = x; col < x + w; col++) {
        this.grid[row][col] = 0;
      }
    }
  }

  /**
   * Corredor em L entre duas salas.
   * Parte das BORDAS de cada sala, nunca do interior,
   * para não "rasgar" o espaço interno das salas.
   */
  carveCorridorBetweenRooms(roomA, roomB) {
    // Ponto de saída: borda da sala A voltada para B
    const exitA  = getBorderPoint(roomA, roomB);
    // Ponto de entrada: borda da sala B voltada para A
    const entryB = getBorderPoint(roomB, roomA);

    // Escava em L: horizontal primeiro, depois vertical (ou vice-versa)
    if (Math.random() < 0.5) {
      this.carveHorizontal(exitA.x,  entryB.x, exitA.y);
      this.carveVertical(exitA.y,  entryB.y, entryB.x);
    } else {
      this.carveVertical(exitA.y,  entryB.y, exitA.x);
      this.carveHorizontal(exitA.x, entryB.x, entryB.y);
    }
  }

  /** Corredor horizontal (parede → corredor, respeita chão existente) */
  carveHorizontal(x1, x2, y) {
    const from = Math.min(x1, x2);
    const to   = Math.max(x1, x2);
    for (let x = from; x <= to; x++) {
      if (this.isInside(x, y) && this.grid[y][x] === 1) {
        this.grid[y][x] = 2;
      }
    }
  }

  /** Corredor vertical */
  carveVertical(y1, y2, x) {
    const from = Math.min(y1, y2);
    const to   = Math.max(y1, y2);
    for (let y = from; y <= to; y++) {
      if (this.isInside(x, y) && this.grid[y][x] === 1) {
        this.grid[y][x] = 2;
      }
    }
  }

  overlapsAny(candidate) {
    return this.rooms.some((room) => rectsOverlap(candidate, room, 1));
  }

  // ---------------------------------------------------------------------------
  // Consultas de tile
  // ---------------------------------------------------------------------------

  isInside(x, y) {
    return x >= 0 && y >= 0 && x < this.width && y < this.height;
  }

  isWall(x, y) {
    if (!this.isInside(x, y)) return true;
    return this.grid[y][x] === 1;
  }

  isFloor(x, y) {
    if (!this.isInside(x, y)) return false;
    return this.grid[y][x] === 0 || this.grid[y][x] === 2;
  }

  getTile(x, y) {
    if (!this.isInside(x, y)) return -1;
    return this.grid[y][x];
  }

  // ---------------------------------------------------------------------------
  // Posições úteis
  // ---------------------------------------------------------------------------

  /**
   * Retorna o centro da primeira sala — garantidamente tile de chão.
   * Usa BFS como fallback caso o centro não seja chão.
   */
  getPlayerStart() {
    if (this.rooms.length === 0) return this.findAnyFloorTile();

    const [cx, cy] = roomCenter(this.rooms[0]);
    if (this.isFloor(cx, cy)) return { x: cx, y: cy };

    return this.findNearestFloor(cx, cy);
  }

  /**
   * Retorna até `count` posições de chão válidas e não sobrepostas
   * dentro de cada sala (exceto a primeira, que é do jogador).
   *
   * @param {number} count - máximo de spawns por sala
   * @returns {Array<{ x: number, y: number }[]>} array de salas,
   *   cada uma com um array de posições de spawn
   */
  getEnemySpawns(count = 2) {
    return this.rooms.slice(1).map((room) => {
      const positions = this._floorTilesInRoom(room);

      // Embaralha para não spawnar sempre no mesmo canto
      shuffle(positions);

      return positions.slice(0, count);
    });
  }

  /**
   * Retorna todos os tiles de chão (tile === 0) dentro de uma sala.
   * Exclui a borda da sala para evitar spawns colados na parede.
   *
   * @param {{ x, y, w, h }} room
   * @returns {{ x: number, y: number }[]}
   */
  _floorTilesInRoom({ x, y, w, h }) {
    const tiles = [];

    for (let row = y + 1; row < y + h - 1; row++) {
      for (let col = x + 1; col < x + w - 1; col++) {
        if (this.grid[row][col] === 0) {
          tiles.push({ x: col, y: row });
        }
      }
    }

    return tiles;
  }

  /** BFS a partir de (startX, startY) até o tile de chão mais próximo */
  findNearestFloor(startX, startY) {
    const visited = new Set();
    const queue   = [{ x: startX, y: startY }];
    const dirs    = [[1,0],[-1,0],[0,1],[0,-1]];

    while (queue.length > 0) {
      const { x, y } = queue.shift();
      const key = `${x},${y}`;
      if (visited.has(key)) continue;
      visited.add(key);

      if (this.isFloor(x, y)) return { x, y };

      for (const [dx, dy] of dirs) {
        const nx = x + dx;
        const ny = y + dy;
        if (this.isInside(nx, ny) && !visited.has(`${nx},${ny}`)) {
          queue.push({ x: nx, y: ny });
        }
      }
    }

    return this.findAnyFloorTile();
  }

  /** Varre o grid e retorna o primeiro tile de chão */
  findAnyFloorTile() {
    for (let y = 0; y < this.height; y++) {
      for (let x = 0; x < this.width; x++) {
        if (this.isFloor(x, y)) return { x, y };
      }
    }
    return { x: 1, y: 1 };
  }

  // ---------------------------------------------------------------------------
  // Renderização (Construct 3 tilemap)
  // ---------------------------------------------------------------------------

  // ---------------------------------------------------------------------------
  // Grid visual — sorteio único de tiles na geração
  // ---------------------------------------------------------------------------

  /**
   * Sorteia os índices de tile para cada célula UMA VEZ, logo após a geração.
   * Isso garante que o mapa não "pisca" ao re-renderizar a cada movimento.
   * Para regenerar o mapa com tiles diferentes, basta instanciar um novo GameMap.
   */
  _buildVisualGrid() {
    const { floor, wall } = this.theme;

    for (let y = 0; y < this.height; y++) {
      this.visualGrid[y] = [];
      for (let x = 0; x < this.width; x++) {
        const cell = this.grid[y][x];
        this.visualGrid[y][x] = cell === 1 ? pickTile(wall) : pickTile(floor);
      }
    }
  }

  // ---------------------------------------------------------------------------
  // Névoa de guerra
  // ---------------------------------------------------------------------------

  /** Inicializa toda a visibilidade como 'hidden' */
  _initVisibility() {
    for (let y = 0; y < this.height; y++) {
      this.visibility[y] = [];
      for (let x = 0; x < this.width; x++) {
        this.visibility[y][x] = 'hidden';
      }
    }
  }

  /**
   * Atualiza a visibilidade com base na posição do jogador.
   * Revela um círculo de raio 2 ao redor do jogador usando
   * distância euclidiana (dx² + dy² <= r²).
   *
   * @param {number} playerGridX
   * @param {number} playerGridY
   */
  updateVisibility(playerGridX, playerGridY) {
    const RADIUS   = 2;
    const RADIUS_SQ = RADIUS * RADIUS;

    // Reseta tudo para hidden
    for (let y = 0; y < this.height; y++) {
      for (let x = 0; x < this.width; x++) {
        this.visibility[y][x] = 'hidden';
      }
    }

    // Revela círculo ao redor do jogador
    for (let dy = -RADIUS; dy <= RADIUS; dy++) {
      for (let dx = -RADIUS; dx <= RADIUS; dx++) {
        // Distância euclidiana ao quadrado — sem Math.sqrt para performance
        if (dx * dx + dy * dy <= RADIUS_SQ) {
          const tx = playerGridX + dx;
          const ty = playerGridY + dy;
          if (this.isInside(tx, ty)) {
            this.visibility[ty][tx] = 'visible';
          }
        }
      }
    }
  }

  /**
   * Renderiza o mapa aplicando névoa de guerra.
   * Tiles 'hidden' usam o tile preto definido em themes.js (theme.hidden).
   * Tiles 'visible' usam o índice pré-sorteado do visualGrid.
   * Deve ser chamado após updateVisibility().
   */
  renderFog(tilemap) {
    const hiddenTile = this.theme.hidden ?? 0;

    for (let y = 0; y < this.height; y++) {
      for (let x = 0; x < this.width; x++) {
        if (this.visibility[y][x] === 'hidden') {
          tilemap.setTileAt(x, y, hiddenTile);
        } else {
          tilemap.setTileAt(x, y, this.visualGrid[y][x]);
        }
      }
    }
  }

  /**
   * Renderiza o mapa no tilemap do Construct 3 aplicando o tema visual.
   *
   * Cada célula do grid lógico é convertida para um índice de tile
   * sorteado a partir das opções do tema ativo:
   *   - chão (0) e corredor (2) → pool theme.floor  (mesmos tiles)
   *   - parede (1)              → pool theme.wall
   *
   * O sorteio acontece aqui, na renderização — o grid lógico
   * permanece com valores 0/1/2 para que a lógica do jogo não mude.
   */
  render(tilemap) {
    // Usa o visualGrid pré-sorteado — tiles não mudam a cada chamada
    for (let y = 0; y < this.height; y++) {
      for (let x = 0; x < this.width; x++) {
        tilemap.setTileAt(x, y, this.visualGrid[y][x]);
      }
    }
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function roomCenter({ x, y, w, h }) {
  return [Math.floor(x + w / 2), Math.floor(y + h / 2)];
}

function roomDistance(a, b) {
  const [ax, ay] = roomCenter(a);
  const [bx, by] = roomCenter(b);
  return Math.sqrt((bx - ax) ** 2 + (by - ay) ** 2);
}

/**
 * Retorna o tile da BORDA da sala `from` mais próximo do centro de `to`.
 * Isso garante que o corredor começa/termina exatamente na parede da sala,
 * sem entrar no interior nem ficar solto no vazio.
 */
function getBorderPoint(from, to) {
  const [fx, fy] = roomCenter(from);
  const [tx, ty] = roomCenter(to);

  // Determina em qual eixo a distância é maior para escolher a borda correta
  const dx = tx - fx;
  const dy = ty - fy;

  if (Math.abs(dx) >= Math.abs(dy)) {
    // Borda esquerda ou direita
    const borderX = dx > 0 ? from.x + from.w - 1 : from.x;
    return { x: borderX, y: fy };
  } else {
    // Borda superior ou inferior
    const borderY = dy > 0 ? from.y + from.h - 1 : from.y;
    return { x: fx, y: borderY };
  }
}

function rectsOverlap(a, b, margin = 0) {
  return (
    a.x - margin < b.x + b.w + margin &&
    a.x + a.w + margin > b.x - margin &&
    a.y - margin < b.y + b.h + margin &&
    a.y + a.h + margin > b.y - margin
  );
}

/** Fisher-Yates shuffle in-place */
function shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}
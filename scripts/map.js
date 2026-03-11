export class GameMap {
  /**
   * @param {number} width  - largura do mapa em tiles
   * @param {number} height - altura do mapa em tiles
   * @param {number} maxRooms - número máximo de salas (MVP: 6 no nível 1)
   */
  constructor(width = 32, height = 32, maxRooms = 6) {
    this.width = width;
    this.height = height;
    this.maxRooms = maxRooms;

    // 0 = chão, 1 = parede, 2 = corredor
    this.grid = [];
    this.rooms = [];

    this.generateEmpty();
    this.generate();
  }

  // ---------------------------------------------------------------------------
  // Geração do mapa
  // ---------------------------------------------------------------------------

  /** Inicializa todo o grid como parede (1) */
  generateEmpty() {
    for (let y = 0; y < this.height; y++) {
      this.grid[y] = [];
      for (let x = 0; x < this.width; x++) {
        this.grid[y][x] = 1;
      }
    }
  }

  /** Orquestra a geração completa do mapa */
  generate() {
    this.rooms = [];

    const MIN_SIZE = 4;
    const MAX_SIZE = 8;
    const MAX_ATTEMPTS = 100;

    for (let i = 0; i < this.maxRooms; i++) {
      let placed = false;
      let attempts = 0;

      while (!placed && attempts < MAX_ATTEMPTS) {
        attempts++;

        const w = randomInt(MIN_SIZE, MAX_SIZE);
        const h = randomInt(MIN_SIZE, MAX_SIZE);

        // margem de 1 tile das bordas
        const x = randomInt(1, this.width - w - 1);
        const y = randomInt(1, this.height - h - 1);

        const candidate = { x, y, w, h };

        if (!this.overlapsAny(candidate)) {
          this.carveRoom(candidate);
          this.rooms.push(candidate);

          // Conecta com a sala anterior via corredor em L
          if (this.rooms.length > 1) {
            const prev = this.rooms[this.rooms.length - 2];
            const [cx1, cy1] = roomCenter(prev);
            const [cx2, cy2] = roomCenter(candidate);
            this.carveCorridor(cx1, cy1, cx2, cy2);
          }

          placed = true;
        }
      }
    }
  }

  // ---------------------------------------------------------------------------
  // Utilitários de geração
  // ---------------------------------------------------------------------------

  /** Escava o interior de uma sala (seta como chão) */
  carveRoom({ x, y, w, h }) {
    for (let row = y; row < y + h; row++) {
      for (let col = x; col < x + w; col++) {
        this.grid[row][col] = 0;
      }
    }
  }

  /**
   * Corredor em L entre dois pontos.
   * Vai na horizontal primeiro, depois na vertical.
   */
  carveCorridor(x1, y1, x2, y2) {
    // Horizontal
    const startX = Math.min(x1, x2);
    const endX   = Math.max(x1, x2);
    for (let x = startX; x <= endX; x++) {
      if (this.isInside(x, y1)) this.grid[y1][x] = 2;
    }

    // Vertical
    const startY = Math.min(y1, y2);
    const endY   = Math.max(y1, y2);
    for (let y = startY; y <= endY; y++) {
      if (this.isInside(x2, y)) this.grid[y][x2] = 2;
    }
  }

  /** Verifica se uma sala candidata sobrepõe alguma sala existente (margem de 1 tile) */
  overlapsAny(candidate) {
    return this.rooms.some((room) => rectsOverlap(candidate, room, 1));
  }

  // ---------------------------------------------------------------------------
  // Consultas de tile
  // ---------------------------------------------------------------------------

  isInside(x, y) {
    return x >= 0 && y >= 0 && x < this.width && y < this.height;
  }

  /** Retorna true se o tile é intransponível (parede ou fora do mapa) */
  isWall(x, y) {
    if (!this.isInside(x, y)) return true;
    return this.grid[y][x] === 1;
  }

  /** Retorna o tile numérico em (x, y), ou -1 se fora do mapa */
  getTile(x, y) {
    if (!this.isInside(x, y)) return -1;
    return this.grid[y][x];
  }

  // ---------------------------------------------------------------------------
  // Posições úteis
  // ---------------------------------------------------------------------------

  /**
   * Retorna o centro da primeira sala — posição de spawn segura para o jogador.
   * @returns {{ x: number, y: number }} coordenadas em GRID
   */
  getPlayerStart() {
    if (this.rooms.length === 0) return { x: 1, y: 1 };
    const [cx, cy] = roomCenter(this.rooms[0]);
    return { x: cx, y: cy };
  }

  /**
   * Retorna o centro de cada sala a partir da segunda.
   * Útil para spawnar inimigos nas salas seguintes.
   * @returns {Array<{ x: number, y: number }>}
   */
  getEnemySpawns() {
    return this.rooms.slice(1).map((room) => {
      const [cx, cy] = roomCenter(room);
      return { x: cx, y: cy };
    });
  }

  // ---------------------------------------------------------------------------
  // Renderização (Construct 3 tilemap)
  // ---------------------------------------------------------------------------

  /**
   * Escreve cada tile no tilemap do Construct 3.
   * Tiles esperados no tileset:
   *   0 → chão
   *   1 → parede
   *   2 → corredor (chão de corredor)
   *  -1 → apaga o tile
   */
  render(tilemap) {
    for (let y = 0; y < this.height; y++) {
      for (let x = 0; x < this.width; x++) {
        tilemap.setTileAt(x, y, this.grid[y][x]);
      }
    }
  }
}

// ---------------------------------------------------------------------------
// Helpers puros (fora da classe para clareza)
// ---------------------------------------------------------------------------

/** Inteiro aleatório em [min, max] */
function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

/** Centro de uma sala em coordenadas de grid */
function roomCenter({ x, y, w, h }) {
  return [Math.floor(x + w / 2), Math.floor(y + h / 2)];
}

/**
 * Verifica sobreposição entre dois retângulos com uma margem opcional.
 * @param {number} margin - tiles de espaço mínimo entre salas
 */
function rectsOverlap(a, b, margin = 0) {
  return (
    a.x - margin < b.x + b.w + margin &&
    a.x + a.w + margin > b.x - margin &&
    a.y - margin < b.y + b.h + margin &&
    a.y + a.h + margin > b.y - margin
  );
}
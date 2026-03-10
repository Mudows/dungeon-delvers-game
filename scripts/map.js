export class GameMap {
  constructor(width, height) {
    this.width = width;
    this.height = height;

    this.grid = [];
    this.rooms = [];

    this.generateEmpty();
    this.generateTestWalls();
  }

  // Gera um grid de mapa vazio
  generateEmpty() {
    for (let y = 0; y < this.height; y++) {
      this.grid[y] = [];

      for (let x = 0; x < this.width; x++) {
        this.grid[y][x] = 0;
      }
    }
  }

  // verifica se um tile está do lado de dentro do mapa,
  // ou seja, não é a parede.
  isInside(x, y) {
    return x >= 0 && y >= 0 && x < this.width && y < this.height;
  }
  
  // verifica se um tile é uma parede (1)
  isWall(x, y) {
    if (!this.isInside(x, y)) return true;

    return this.grid[y][x] === 1;
  }

  // Adiciona paredes de teste ao mapa
  generateTestWalls() {
    for (let y = 0; y < this.height; y++) {
      for (let x = 0; x < this.width; x++) {
        if (
          x === 0 ||
          y === 0 ||
          x === this.width - 1 ||
          y === this.height - 1
        ) {
          this.grid[y][x] = 1;
        }
      }
    }
  }

  // Faz o mapa aparecer visualmente
  render(tilemap) {
    for (let y = 0; y < this.height; y++) {
      for (let x = 0; x < this.width; x++) {
        const tile = this.grid[y][x];

        tilemap.setTileAt(x, y, tile);
      }
    }
  }
}

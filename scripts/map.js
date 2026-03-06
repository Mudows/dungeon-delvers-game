export class GameMap {
  constructor(width, height) {
    this.width = width;
    this.height = height;

    this.grid = [];

    this.generateEmpty();
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

  isInside(x, y) {
    return x >= 0 && y >= 0 && x < this.width && y < this.height;
  }

  isWall(x, y) {
    if (!this.isInside(x, y)) return true;

    return this.grid[y][x] === 1;
  }

  generateTestWalls(){
    for(let y = 0; y < this.height; y++){
      for(let x = 0; x < this.width; x++){
        if(x === 0 || y === 0 || x === this.width - 1 || y === this.height - 1){
          this.grid[y][x] = 1;
        }
      }
    }
  }
}

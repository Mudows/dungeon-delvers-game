export class Grid {
  constructor(tileSize = 16) {
    // tamanho de cada tile em pixels
    this.tileSize = tileSize;
  }

  // converte coordenada de GRID para PIXEL
  toPixel(gridX, gridY) {
    return {
      x: gridX * this.tileSize,
      y: gridY * this.tileSize,
    };
  }

  // converte PIXEL para GRID
  toGrid(pixelX, pixelY) {
    return {
      x: Math.floor(pixelX / this.tileSize),
      y: Math.floor(pixelY / this.tileSize),
    };
  }

  // Move o objeto (instance) em uma direção especificada
  move(instance, dx, dy) {
    const pos = this.toGrid(instance.x, instance.y);
    const newX = pos.x + dx;
    const newY = pos.y + dy;
    const pixel = this.toPixel(newX, newY);
    instance.x = pixel.x;
    instance.y = pixel.y;
  }
}

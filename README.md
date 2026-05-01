# Dungeon Delvers

Roguelike top-down para PC, desenvolvido no Construct 3 com JavaScript. Jogabilidade em turnos sobre grid, geração procedural de mapas e progressão baseada em decisões do jogador.

---

## Stack

| Área          | Tecnologia                     |
|---------------|-------------------------------|
| Engine        | Construct 3                    |
| Linguagem     | JavaScript (módulos ES6)       |
| Arte          | Piskel — pixel art 16×16      |
| SFX           | BFXR / JSFXR                  |
| BGM           | Suno AI                        |
| Documentação  | Obsidian                       |

O GDD completo está em `Docs/GDD/`, organizado pela metodologia MSAT (Mecânicas, Narrativa, Estética, Tecnologia).

---

## Como abrir

O projeto é um arquivo `.c3proj`. Abra pelo [Construct 3](https://editor.construct.net) importando `project.c3proj`, ou abra a pasta raiz diretamente pelo editor.

---

## Controles

| Tecla                    | Ação                                         |
|--------------------------|---------------------------------------------|
| `WASD` / setas           | Movimentação em 4 direções                  |
| Mover em direção a inimigo | Ataque automático (bump attack)           |
| `Enter` / `Espaço`       | Descer para o próximo andar (na escada)     |

---

## Arquitetura

Estrutura modular — cada script tem responsabilidade única.

```
scripts/
  combat.js    Fórmulas de dano (MSAT)
  grid.js      Coordenadas, movimentação e colisão
  map.js       Geração procedural via BSP + MST
  themes.js    Tiles visuais por fase com sorteio ponderado
  turn.js      Ciclo de turnos, factory de inimigos e IA
  hud.js       Interface do jogador
  utils.js     Utilitários compartilhados
  main.js      Orquestração e input

files/
  Enemies.json  Famílias de inimigos (stats, sprites, chance de spawn)
```

---

## Geração de Mapa

Salas posicionadas por BSP e conectadas por MST, garantindo acessibilidade total com o mínimo de corredores. Grade de 32×32 tiles.

---

## Combate

**Físico:** `dano = (ATQ + ATQ_arma) − DEF`, mínimo 1.

O jogador ataca ao se mover em direção a um inimigo. Inimigos atacam ao ficarem adjacentes.

---

## IA dos Inimigos

A cada turno, o inimigo executa a primeira condição verdadeira:

1. **Adjacente ao jogador** — ataca.
2. **Dentro do raio 5×5 (Chebyshev) com linha de visão livre** — persegue via BFS, respeitando paredes e outros inimigos.
3. **Fora do alcance ou atrás de parede** — fica parado.

Linha de visão verificada por Bresenham. Pathfinding via BFS garante o caminho mais curto navegável.

---

## Névoa de Guerra

Implementada na layer **Darkness** do Construct 3: fundo preto sólido com sprite `player_light` em blend *destination-out*, criando uma máscara radial ao redor do jogador. A FoW é puramente visual e não interfere na lógica do mapa.

---

## Temas Visuais

Cada fase usa um tema com pools ponderados de tiles para chão e parede. Os índices são sorteados uma única vez na geração do mapa, sem variação durante o jogo.

| Tema             | Labirintos | Status      |
|------------------|------------|-------------|
| Caverna          | 1–3        | Ativo       |
| Catacumba        | 4–6        | Placeholder |
| Inferno Congelado | 7–9       | Placeholder |

---

## Estrutura Narrativa

10 labirintos progressivos + nível 0 (hub inicial com baú de herança).

| Labirintos | Tema               | Inimigos       |
|------------|--------------------|----------------|
| 1–3        | Caverna            | Goblins        |
| 4–6        | Catacumba          | Mortos-vivos   |
| 7–9        | Inferno Congelado  | —              |
| 10         | Horror Cósmico     | Chefe final    |

Para avançar é necessário derrotar todos os inimigos do andar. A derrota retorna o jogador ao hub.

---

## MVP — Pipeline

| Etapa                                        | Status     |
|----------------------------------------------|------------|
| Movimentação em grid (WASD + setas)          | Concluído  |
| Geração procedural de salas e corredores     | Concluído  |
| Sistema de turnos (jogador → inimigos)       | Concluído  |
| Combate físico (bump attack, fórmula MSAT)   | Concluído  |
| Spawn de inimigos por família ponderada      | Concluído  |
| HUD do jogador (barra de HP + texto)         | Concluído  |
| Barras de HP dos inimigos                    | Concluído  |
| Temas visuais por fase                       | Concluído  |
| IA de movimento dos inimigos (BFS + LOS)     | Concluído  |
| Névoa de guerra                              | Concluído  |
| Interface mínima                             | Pendente   |
| Inventário                                   | Pendente   |
| Progressão do jogador entre andares          | Pendente   |
| Conteúdo completo (3 andares + chefes)       | Pendente   |

---

## Fora do MVP

Sistema de lanterna, magias do jogador, vendedor misterioso, bombas, elixires e ouro estão planejados para fases posteriores ao MVP.

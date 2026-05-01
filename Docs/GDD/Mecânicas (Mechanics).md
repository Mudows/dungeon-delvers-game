## Core Gameplay
- Movimentação baseada em **turnos**, em grid, 4 direções.
- Não é possível mover na diagonal.
- Movimento, ataque, uso de item ou interação equivalem a **uma ação**.
- Após a ação do jogador, todos os inimigos realizam uma ação.

## Sistema de Turnos
- Todos os inimigos têm direito a uma ação por turno.
- A ordem de ação dos inimigos segue a ordem de spawn (inserção na lista).
  - A lista só é alterada quando um inimigo morre.

## Visão e Exploração
- Névoa de guerra implementada via layer **Darkness** no Construct 3: fundo preto sólido com sprite `player_light` em blend *destination-out*, que recorta uma área circular de visibilidade ao redor do jogador.
- O raio de visão é **radial (circular)**, não um quadrado fixo. Raio atual: ~3 tiles (sprite de 96×96 px com tile de 16 px).
- A FoW visual é cosmética — não bloqueia o campo de visão por paredes.
- Inimigos verificam **linha de visão** (algoritmo de Bresenham) antes de perseguir: não são ativados através de paredes, mesmo que o jogador esteja dentro do raio de detecção.
- Salas não visitadas não são renderizadas.
- Salas descobertas permanecem cobertas pela névoa quando fora da visão.

## Combate
- **Combate físico — rolagem contestada:**
  1. `attackRoll = rand(0–10) + ATQ do atacante`
  2. `defenseRoll = rand(0–10) + DEF do defensor`
  3. `attackRoll > defenseRoll` → acerto: `dano = ATQ_arma + (attackRoll − defenseRoll)`
  4. `defenseRoll ≥ attackRoll` → erro: nenhum dano.
- Dano mínimo ao acertar: **ATQ_arma + 1**. Sem arma equipada, mínimo = **1**.
- A mesma fórmula se aplica a ataques de inimigos contra o jogador.
- **Combate mágico:**
  - `(MAG do jogador + MAG da magia) − RES do alvo`
- Ataque físico exige alvo adjacente.
- Ataque mágico exige alvo dentro do alcance e no campo de visão.

## Progressão do Jogador
- Ao concluir um labirinto, o jogador escolhe:
  - +1 em ATQ, DEF ou MAG  
  - **ou** +5 em Vida ou Mana máxima
- Nos labirintos **3, 6 e 9**, a escolha acontece **duas vezes**.
- Vida e Mana são totalmente restauradas ao derrotar chefes (a cada 3 labirintos).

## Inventário e Equipamentos
- Inventário com **9 slots**.
- Itens iguais se acumulam.
- Emplastros e Éter não ocupam slot (máx. 10 de cada).
- Slots de equipamento:
  - Arma
  - Armadura
  - Amuleto
  - 3 slots de itens diversos
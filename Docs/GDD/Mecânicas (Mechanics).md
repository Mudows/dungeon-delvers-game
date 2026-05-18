## Core Gameplay
- Movimentação baseada em **turnos**, em grid, 4 direções.
- Não é possível mover na diagonal.
- Movimento, ataque, uso de item ou interação equivalem a **uma ação**.
- Após a ação do jogador, todos os inimigos realizam uma ação.

## Estatísticas de Personagens
Todo personagem do jogo possui um conjunto de estatísticas em comum que são utilizadas para resolver as situações de combate. São elas:
- **Vida (hp_max / hp_curr):** Controla a quantidade máxima e atual de vida do personagem. Se chegar a zero, ele é destruído.
- **Mana (mana_max / mana_curr):** Controla a quantidade máxima e atual de mana do personagem. É necessário para lançar magias.
- **Ataque (atq_base):** Valor utilizado para realizar ataques e provocar dano ao oponente.
- **Magia (mag_base):** Valor utilizado para realizar ataques e efeitos mágicos.
- **Defesa (def_base):** Utilizado nas jogadas de defesa contra ataques físicos
- **Resistência (res_base):** Utilizado nas jogadas de defesa contra ataques e efeitos mágicos

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
Ao concluir um nível do labirinto, é apresentada uma lista com quatro opções de upgrade para o personagem do jogador, onde essas opções são escolhidas aleatoriamente sendo sempre uma combinação entre dois atributos. Por exemplo:
  - +1 ATQ e +1 MAG
  - +1 MAG e +10 Mana
  - +1 DEF e +1 RES
  - +10 Vida e + 10 Mana
 
Note que quando for um atributo de cálculo (ATQ/MAG/DEF/RES), o bônus é sempre de +1, enquanto os atributos de recurso (Vida e Mana) é sempre +10.
Nos labirintos **3, 6 e 9**, o efeito da escolha é dobrado.
#### Observações  
- Vida e Mana são totalmente restauradas ao derrotar chefes (a cada 3 labirintos).
- Ao escolher upgrades que aumentam Vida ou Mana, o mesmo valor também é adicionado no valor atual do atributo em questão.

## Inventário e Equipamentos
- Inventário com **9 slots**.
- Itens iguais se acumulam.
- Emplastros e Éter não ocupam slot (máx. 10 de cada).
- Slots de equipamento:
  - Arma
  - Armadura
  - Amuleto
  - 3 slots de itens diversos
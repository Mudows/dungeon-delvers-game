## Core Gameplay
- Movimentação baseada em **turnos**, em grid, 4 direções.
- Não é possível mover na diagonal.
- Movimento, ataque, uso de item ou interação equivalem a **uma ação**.
- Após a ação do jogador, todos os inimigos realizam uma ação.

## Sistema de Turnos
- Todos os inimigos têm direito a uma ação por turno.
- A ordem de ação dos inimigos é definida por uma lista:
  - Inimigos mais próximos e ativados agem primeiro.
  - A lista só muda quando um inimigo morre.

## Visão e Exploração
- Campo de visão limitado, não ultrapassa paredes.
- Visão definida por uma área de **5×5 quadrados**.
- Salas não visitadas não são renderizadas.
- Salas descobertas permanecem cobertas por “névoa de guerra” quando fora da visão.

## Combate
- **Combate físico:**
  - `(ATQ do jogador + ATQ da arma) − DEF do alvo`
- **Combate mágico:**
  - `(MAG do jogador + MAG da magia) − RES do alvo`
- Dano mínimo sempre igual a **1**.
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
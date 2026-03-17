# GDD Dungeon Delvers

## 1. Visão Geral

**Gênero:** Roguelike (turn-based, grid-based)  \
**Plataforma:** PC  \
**Faixa Etária:** 10+  \
**Câmera:** Top-down (90°)  \
**Controles:** Teclado e mouse

**Pilares de Design:**
- Combate tático simples e legível
- Progressão curta, clara e recompensadora
- Escopo controlado e expansível

---

## 2. Core Gameplay Loop

1. Jogador explora salas do labirinto
2. Enfrenta inimigos em combate por turnos
3. Coleta itens e gerencia inventário limitado
4. Derrota todos os inimigos do nível
5. Portal surge → próximo labirinto
6. Ao final de ciclos específicos, recebe progressão permanente

---

## 3. Mecânicas de Jogo

### 3.1 Jogador

**Atributos Iniciais**

| Atributo | Valor | Descrição |
|---|---|---|
| Vida (VD) | 10 | Ao chegar a 0, o jogador morre |
| Mana (MN) | 10 | Recurso para magias |
| Ataque (ATQ) | 1 | Base de dano físico |
| Defesa (DEF) | 1 | Reduz dano físico |
| Magia (MAG) | 1 | Base de dano mágico |
| Resistência (RES) | 1 | Reduz dano mágico |

**Equipamento Inicial**
- Espada de Aventureiro (ATQ +1)
- 2× Emplastro
- 1× Éter

**Visão**
- Campo de visão **não atravessa paredes**
- Raio fixo de 5×5 quadrados

---

### 3.2 Progressão

- Ao concluir um labirinto, o jogador escolhe **1 melhoria**:
  - +1 ATQ, DEF ou MAG
  - **ou** +5 Vida Máxima
  - **ou** +5 Mana Máxima
- Ao concluir os labirintos **3, 6 e 9**, o jogador faz **2 escolhas**

---

### 3.3 Regras Gerais

- Jogo baseado em **turnos**, em grid de **4 direções**
- Cada ação consome 1 turno:
  - Movimento
  - Ataque
  - Uso de item
  - Interação
- Após a ação do jogador, **todos os inimigos ativos** executam 1 ação

**Regras de Inimigos**
- Inimigo é **descoberto** quando o jogador entra na sala
- Inimigos descobertos:
  - Atuam mesmo fora do campo de visão
  - Sempre perseguem o jogador (pathfinding)
- Prioridade de ação:
  - Ordem fixa baseada na proximidade do jogador
  - Lista só muda quando um inimigo morre
- Inimigos:
  - Não se movem na diagonal
  - Não atravessam outros inimigos
  - Não ocupam o mesmo tile

**Mapa e Renderização**
- Salas não visitadas não são renderizadas
- Salas visitadas fora do FOV ficam sob névoa de guerra
- Viewport máximo: **16×16 tiles**

---

## 4. Combate

### 4.1 Ataque Físico

```
Dano = (ATQ do atacante + ATQ da arma) - DEF do alvo
Dano mínimo = 1
```

- Ataques corpo-a-corpo exigem adjacência

### 4.2 Ataque Mágico

```
Dano = (MAG do atacante + MAG da magia) - RES do alvo
Dano mínimo = 1
```

- Alcance padrão: 5 quadrados
- Alvo deve estar dentro do campo de visão

---

## 5. Itens e Inventário

### 5.1 Equipamentos

- **Arma:** define dano
- **Armadura:** incrementa DEF
- **Amuleto:** incrementa RES
- **Slots diversos:** 3 (consumíveis ou itens mágicos)

### 5.2 Consumíveis

| Item | Efeito |
|---|---|
| Emplastro | Recupera 3 VD |
| Éter | Recupera 4 MN |

> Emplastro e Éter não ocupam slot de inventário e podem chegar a 10 unidades cada.

### 5.3 Inventário

- 9 slots
- Itens iguais se acumulam

---

## 6. Estrutura de Níveis

- Total planejado: **10 labirintos + Hub (nível 0)**
- Para avançar de nível:
  - Derrotar **todos os inimigos**
  - Um **portal surge na sala atual**

### Temas

| Níveis | Tema | Chefão |
|---|---|---|
| 1–3 | Caverna | Goblin Shaman |
| 4–6 | Catacumba | Necromante |
| 7–9 | Inferno Congelado | Demônio de Gelo |
| 10 | Horror Cósmico | Entidade Final |

---

## 7. Inimigos – MVP (Caverna)

| Inimigo | VD | MN | ATQ | DEF | MAG | RES | Aparece em |
|---|---|---|---|---|---|---|---|
| Goblin | 3 | 0 | 1 | 0 | 0 | 0 | 1–3 |
| Goblin Guerreiro | 5 | 0 | 2 | 1 | 0 | 0 | 1–3 |
| Goblin Feiticeiro | 4 | 5 | 1 | 1 | 2 | 1 | 2–3 |
| Goblin Shaman (Boss) | 10 | 10 | 3 | 2 | 3 | 2 | 3 |

**Drop Básico por Inimigo**
- 30% Emplastro
- 20% Éter
- 10% Arma
- 40% Nada

---

## 8. Estética

- Tiles de **16×16 pixels**
- Pixel Art estilo **Dark Fantasy (16-bit)**

**Áudio**
- BGM 16-bit inspirado em Metal
- Faixa específica por tema
- SFX para:
  - Ataque, dano, morte, vitória, movimento

**UI**
- Barra de Vida
- Barra de Mana
- Contador de Emplastro e Éter (atalhos)
- Tela de Inventário

---

## 9. Tecnologia

- **Engine:** ~~PyGame~~ Construct 3 com JavaScript
- ~~**Testes:** PyTest (lógica e regras)~~
- **Arte:** Piskel
- **Tilesets:** Tilesetter
- **Áudio:** Bfxr/jsfxr (SFX), Suno AI (BGM)

---

## 10. MVP

### Inclui
- Labirintos 1 a 3 (Caverna)
  - Nível 1: até 6 salas
  - Nível 2: até 8 salas
  - Nível 3: até 10 salas
  - Salas: 4×4 a 10×10
- Combate funcional
- Inventário funcional
- Apenas inimigos goblins
- Armas com ATQ entre 2 e 4

### Exclui
- Sistema de lanterna
- Sistema de herança
- Vendedor
- Bombas
- Elixires
- Magia do jogador
- Ouro

---

## 11. Expansão Futura

- Sistema de herança
- Magias e itens avançados
- Novos biomas
- Economia e vendedores
- Novos inimigos e chefes


/**
 * Card class representing a playing card
 * Suits: '♠', '♥', '♦', '♣'
 * Ranks: 'J', 'Q', 'K', 'A', '7', '8', '9', '10'
 * Special: 'JOKER'
 */
export class Card {
  constructor(suit, rank) {
    this.suit = suit;
    this.rank = rank;
    this.id = `${suit}${rank}`;
  }

  isJoker() {
    return this.rank === 'JOKER';
  }

  static createJoker(id = 1) {
    const card = new Card('JOKER', 'JOKER');
    card.jokerId = id;
    card.id = `JOKER_${id}`;
    return card;
  }

  rankValue() {
    const rankOrder = ['6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];
    return rankOrder.indexOf(this.rank);
  }

  toString() {
    return this.id;
  }

  equals(other) {
    return this.id === other.id;
  }

  static fromString(str) {
    if (str.startsWith('JOKER_')) return Card.createJoker(parseInt(str.split('_')[1], 10));
    for (const suit of ['♠', '♥', '♦', '♣']) {
      if (str.startsWith(suit)) return new Card(suit, str.slice(suit.length));
    }
    throw new Error(`Cannot parse card: ${str}`);
  }
}

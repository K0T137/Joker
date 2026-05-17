import { Card } from './Card.js';

/**
 * 36-card Joker deck.
 */
export class Deck {
  constructor() {
    this.cards = [];
    this.initializeDeck();
  }

  initializeDeck() {
    const suits = ['♠', '♥', '♦', '♣'];
    const ranks = ['7', '8', '9', '10', 'J', 'Q', 'K', 'A'];

    // Add regular cards
    for (const suit of suits) {
      for (const rank of ranks) {
        this.cards.push(new Card(suit, rank));
      }
    }

    // 6♥ and 6♦ are included; 6♠ and 6♣ are not (Joker deck rule)
    this.cards.push(new Card('♥', '6'));
    this.cards.push(new Card('♦', '6'));

    // Add 2 jokers
    this.cards.push(Card.createJoker(1));
    this.cards.push(Card.createJoker(2));

    if (this.cards.length !== 36) {
      throw new Error(`Deck must have 36 cards, got ${this.cards.length}`);
    }
  }

  shuffle() {
    for (let i = this.cards.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [this.cards[i], this.cards[j]] = [this.cards[j], this.cards[i]];
    }
    return this;
  }

  draw(count = 1) {
    return this.cards.splice(0, count);
  }

  peek(index = 0) {
    return this.cards[index];
  }

  remaining() {
    return this.cards.length;
  }

  reset() {
    this.cards = [];
    this.initializeDeck();
    return this;
  }
}

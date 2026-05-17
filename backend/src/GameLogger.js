/**
 * GameLogger — append-only JSONL event log for a single room.
 *
 * One file per room: logs/<ROOMID>_<ISO-timestamp>.jsonl
 * Each line is a self-contained JSON object:
 *   { ts, room, event, ...eventData }
 *
 * Writes are async (fs.appendFile) so they never block the event loop.
 * The log captures enough state to replay, analyse, or debug any game.
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
export const LOGS_DIR = path.join(__dirname, '..', 'logs');

// Create the logs directory on first import if it doesn't exist yet.
fs.mkdirSync(LOGS_DIR, { recursive: true });

export class GameLogger {
  constructor(roomId) {
    this.roomId = roomId;
    const ts = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    this.filePath = path.join(LOGS_DIR, `${roomId}_${ts}.jsonl`);
  }

  /**
   * Write one event.  eventData is merged into the top-level object so
   * common fields (player, card, scores …) sit at the root — easier to grep.
   */
  log(event, data = {}) {
    const line = JSON.stringify({ ts: Date.now(), room: this.roomId, event, ...data }) + '\n';
    fs.appendFile(this.filePath, line, err => {
      if (err) console.error(`[log] write error ${this.roomId}: ${err.message}`);
    });
  }
}

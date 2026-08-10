
import { Redis } from "ioredis";
import { RoomState, Player ,GameState} from "../../../packages/shared/index.js";

export class RoomStore {
  constructor(private redis: Redis) { }
  async saveRoom(state: RoomState): Promise<void> {
    const key = `room:${state.roomId}`;
    await this.redis.set(key, JSON.stringify(state));

    await this.redis.expire(key, 7200);
  }

  async getRoom(roomId: string): Promise<RoomState | null> {
    const data = await this.redis.get(`room:${roomId}`);
    if (!data) return null;
    return JSON.parse(data) as RoomState;
  }

  async joinOrUpdatePlayer(roomId: string, newPlayer: Player): Promise<RoomState | null> {

    const room = await this.getRoom(roomId);
    if (!room) return null;
    const existingPlayerIndex = room.players.findIndex(p => p.id === newPlayer.id);

    if (existingPlayerIndex !== -1) {
      console.log(`Player ${newPlayer.name} reconnected! Updating socket...`);
      room.players[existingPlayerIndex].socketId = newPlayer.socketId;
    } else {
      room.players.push(newPlayer);
    }
    await this.saveRoom(room);
    return room;
  }


  async leavePlayer(roomId: string, playerId: string): Promise<{ room: RoomState | null; removed: Player | null }> {
    const room = await this.getRoom(roomId);
    if (!room) return { room: null, removed: null };

    const removed = room.players.find((p) => p.id === playerId) ?? null;
    room.players = room.players.filter((p) => p.id !== playerId);

    if (room.players.length === 0) {
      await this.deleteRoom(roomId);
      return { room: null, removed };
    }
    if (!room.players.some((p) => p.isHost)) {
      room.players[0].isHost = true;
    }
    await this.saveRoom(room);
    return { room, removed };
  }

  async deleteRoom(roomId: string): Promise<void> {
    await this.redis.del(`room:${roomId}`);
  }
  async getHost(roomId: string): Promise<Player | null> {
    const room = await this.getRoom(roomId);
    if(!room) return null;
    const host = room.players.find(p => p.isHost);
    return host ?? null ;
  }
  async startGame(roomId: string, game: GameState): Promise<RoomState | null> {
    const room = await this.getRoom(roomId);
    if (!room) return null;
    room.status = "playing";
    room.game = game;
    await this.saveRoom(room);
    return room;
  }
} 
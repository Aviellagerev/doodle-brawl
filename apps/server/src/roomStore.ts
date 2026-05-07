
import { Redis } from "ioredis";
import { RoomState,Player} from "../../../packages/shared/index.js"; 

export class RoomStore {
  constructor(private redis: Redis) {}


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

  async deleteRoom(roomId: string): Promise<void> {
    await this.redis.del(`room:${roomId}`);
  }
}
import { RoomState, Player,GameState} from "../../../../packages/shared/index.js";


export function generateRoomCode(): string {
  
    const chars = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
    let result = "";
    for (let i = 0; i < 6; i++) {
        result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
}
export function createNewPlayer(
  { id, socketId, name, isHost }: { id: string; socketId: string; name: string; isHost: boolean }
): Player {
  return { id, socketId, name, score: 0, isHost };
}
//this function expects a player as input and RoomState as output 
export function createNewRoom(host:Player):RoomState {
    const roomId = generateRoomCode();
     return{
        roomId:roomId,
        players:[host],
        status:"waiting",
     };
}

export function createNewGameState(startId: string):GameState{
  return {
    currentDrawerId:startId,
    round:0,
    phase:"choosing",
    wordLength:null,
    word:null,
  };
}


export interface Player {
  id: string;        
  socketId: string; 
  name: string;      
  score?: number;   
  isHost?: boolean; 
}
export interface RoomState {
  roomId: string;
  players: Player[];
  status: "waiting" | "playing" | "finished";
}

export interface RoomResponse {
  success: boolean;
  roomId?: string;
  error?: boolean;
}
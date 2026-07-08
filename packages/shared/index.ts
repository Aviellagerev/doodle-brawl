

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
  game?:GameState;
}

export interface RoomResponse {
  success: boolean;
  roomId?: string;
  room?:RoomState;
  error?: boolean | string;
}
export interface GameState {
  currentDrawerId: string;              
  round: number;                        
  phase: "choosing" | "drawing";       
  wordLength: number | null;            
  word: string | null;                  
}

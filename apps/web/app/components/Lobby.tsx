import { RoomState } from "../../../../packages/shared";
import PlayerList from "./game/PlayerList";

type LobbyProps = {
    room: RoomState;
    onLeave: () =>void;
    onStart: () =>void;
};

export default function Lobby({ room,onLeave,onStart }: LobbyProps) {
    return (
        <div>
            <header>the lobby code {room.roomId}</header>

           { /*plays in lobby*/ }
            <PlayerList players={room.players} />

            <ul>
                <li>
            <button onClick={()=>onLeave()}>Leave</button> 
            </li>
            <li>
                 <button onClick={()=>onStart()}>start</button>
            </li>
            </ul>
           

        </div>

    );
}

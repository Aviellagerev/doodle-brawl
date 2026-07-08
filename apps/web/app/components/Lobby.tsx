import { RoomState } from "../../../../packages/shared";

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
            <ul>
                {room.players.map((p) => (
                    <li key={p.id}>
                        {p.name}{p.isHost ? " 👑" : ""}
                    </li>
                ))}
            </ul>
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

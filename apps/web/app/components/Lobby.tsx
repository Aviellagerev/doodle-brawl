import { RoomState } from "../../../../packages/shared";

type LobbyProps = {
    room: RoomState;
    onLeave: () =>void;
};

export default function Lobby({ room,onLeave }: LobbyProps) {
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
            <button onClick={()=>onLeave()}>Leave</button> 
        </div>

    );
}

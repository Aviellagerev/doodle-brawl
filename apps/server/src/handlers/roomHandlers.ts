import { Server, Socket } from "socket.io";
import { RoomStore } from "../roomStore";
import { RoomState, Player, GameState } from "../../../../packages/shared/index.js";
import { createNewRoom, createNewPlayer,createNewGameState } from "./../services/roomServices.js";
import {pickWords} from './gameHandlers.js'
export function registerRoomHandlers(io: Server, socket: Socket, roomStore: RoomStore) {
    socket.on("create_room", async (data, callback) => {
        const hostPlayer: Player = createNewPlayer({
            id: data.id,
            socketId: socket.id,
            name: data.name,
            isHost: true,
        });

        const newRoom: RoomState = createNewRoom(hostPlayer);

        try {
            await roomStore.saveRoom(newRoom);

            socket.join(newRoom.roomId);
            socket.data.roomId = newRoom.roomId;
            socket.data.playerId = hostPlayer.id;
            io.to(newRoom.roomId).emit("room_update", newRoom);
            console.log(`Room ${newRoom.roomId} created by ${hostPlayer.name}`);

            callback({ success: true, roomId: newRoom.roomId, room: newRoom });

        } catch (error) {
            console.error("Failed to create room:", error);
            callback({ success: false, error: true });
        }
    })


    socket.on('join_room', async (data, callback) => {
        const roomId = data.code;
        const newPlayer: Player = createNewPlayer({
            id: data.id,
            socketId: socket.id,
            name: data.name,
            isHost: false,
        })

        try {
            const room = await roomStore.joinOrUpdatePlayer(roomId, newPlayer);

            if (room != null) {

                socket.join(roomId);
                socket.data.roomId = room.roomId;
                socket.data.playerId = newPlayer.id;
                console.log(`user: ${newPlayer.name} joined id: ${newPlayer.id}`);
                io.to(roomId).emit("room_update", room);
                io.to(roomId).emit("system_message", `${newPlayer.name} joined the room`);
                callback({ success: true, roomId: roomId, room });
            }
            else {
                callback({
                    success: false,
                    error: "Room not found. Check the code and try again."
                });
            }
        }
        catch (error) {
            console.error(`Failed to join room ${roomId}:`, error);
            callback({
                success: false,
                error: "Server error while joining. Please try again."
            });
        }
    });

    socket.on("leave_room", async (data, callback) => {
        try {
            const { room, removed } = await roomStore.leavePlayer(data.roomId, data.id);
            socket.leave(data.roomId);
            if (room) {
                io.to(room.roomId).emit("room_update", room);
                io.to(room.roomId).emit("system_message", `${removed?.name ?? "A player"} left the room`);
            }
            callback({ success: true });
        } catch (error) {
            console.error(`Failed to leave room ${data.roomId}:`, error);
            callback({ success: false, error: "Server error while leaving." });
        }
    });
    socket.on('disconnect', async () => {
        const roomId = socket.data.roomId;
        const playerId = socket.data.playerId;
        if (!roomId || !playerId) return;

        try {
            const { room, removed } = await roomStore.leavePlayer(roomId, playerId);
            if (room) {
                io.to(roomId).emit("room_update", room);
                io.to(roomId).emit("system_message", `${removed?.name ?? "A player"} left the room`);
            }
        } catch (error) {
            console.error(`Disconnect cleanup failed for room ${roomId}:`, error);
        }

    });

        //button start presesd 
    socket.on('start_game', async () =>{
        const roomId = socket.data.roomId;
        if(!roomId) return;
       
        try{
            const getHost  = await roomStore.getHost(roomId);
            if(!getHost) return{error:"no host!"};
            const gameStart : GameState  = createNewGameState(getHost);
            //new game state creating 
            //no we send to the host word choosing 
            //we know 3 words
            const words : string[] = pickWords();
            console.log(`send ${words}`);
            io.to(getHost).emit("word_pick",words);
            //after updateidn in the startGame function we emit to the host the 3 words;
            //to choose then we start the loop 
            
        }
        catch(error){
             console.error(`somthing went bad with start at this id ${roomId}`,error);
        }
    
    });

}
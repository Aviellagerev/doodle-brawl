import { Server, Socket } from "socket.io";
import { RoomStore } from "../roomStore";
import { RoomState, Player } from "../../../../packages/shared/index.js";
import { createNewRoom, createNewPlayer } from "./../services/roomServices.js";

// DEBUG: print every socket currently in a given room to the server console.
async function logRoomSockets(io: Server, roomId: string) {
    const sockets = await io.in(roomId).fetchSockets();
    console.log(`[room ${roomId}] sockets:`, sockets.map((s) => s.id));
}

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
                console.log(`user: ${newPlayer.name} joined id: ${newPlayer.id}`);
                io.to(roomId).emit("room_update", room);
                io.to(roomId).emit("system_message", `${newPlayer.name} joined the room`);
                await logRoomSockets(io, roomId);
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
            const room = await roomStore.leavePlayer(data.roomId, data.id);
            socket.leave(data.roomId);
            if (room) {
                io.to(room.roomId).emit("room_update", room);
                // TODO: leavePlayer only returns the remaining room, not who left,
                // so we can't name them yet. Return the removed player to improve this.
                io.to(room.roomId).emit("system_message", `A player left the room`);
            }
            await logRoomSockets(io, data.roomId);
            callback({ success: true });
        } catch (error) {
            console.error(`Failed to leave room ${data.roomId}:`, error);
            callback({ success: false, error: "Server error while leaving." });
        }
    });



}
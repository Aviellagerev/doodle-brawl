import Fastify from "fastify";
import { Server } from "socket.io";
import { RoomStore } from "./roomStore.js"
import { redis } from "./redis.js";
import { RoomState, RoomResponse, Player } from "../../../packages/shared/index.js";

const roomStore = new RoomStore(redis);
const app = Fastify({ logger: true });
app.get("/health", async () => ({ ok: true }));
const start = async () => {
    await app.listen({ port: 3001, host: "0.0.0.0" });
    const io = new Server(app.server, {
        cors: { origin: "http://localhost:3000" },
    });

    io.on("connection", (socket) => {
        console.log("connected");
        socket.on('create_room', async (data, callback) => {
            const hostPlayer: Player = {
                id: data.id,
                socketId: socket.id,
                name: data.name,
                score: 0,
                isHost: true
            }
            try {
                const roomId = generateRoomCode();

                const newRoom: RoomState = {
                    roomId: roomId,
                    players: [hostPlayer],
                    status: "waiting"
                };

            
                await roomStore.saveRoom(newRoom);

                socket.join(roomId);
                console.log(`Room ${roomId} created by ${hostPlayer.name}`);

                callback({ success: true, roomId: roomId });

            } catch (error) {
                console.error("Failed to create room:", error);
                callback({ success: false, error: true });
            }
        });
        socket.on('join_room', async (data, callback) => {
            const roomId = data.code;
            const newPlayer: Player = {
                id: data.id,
                socketId: socket.id,
                name: data.name,
                score: 0,
                isHost: false
            };

            try {
                const room = await roomStore.joinOrUpdatePlayer(roomId, newPlayer);

                if (room != null) {

                    socket.join(roomId);
                    console.log(`user: ${newPlayer.name} joined id: ${newPlayer.id}`);
                    io.to(roomId).emit("user_join", newPlayer.name);
                    callback({ success: true, roomId: roomId });
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
    });
};
start();
function generateRoomCode(): string {
  
    const chars = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
    let result = "";
    for (let i = 0; i < 6; i++) {
        result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
}
import Fastify from "fastify";
import { Server } from "socket.io";
const app = Fastify({ logger: true });
app.get("/health", async () => ({ ok: true }));
const start = async () => {
    await app.listen({ port: 3001, host: "0.0.0.0" });
    const io = new Server(app.server, {
        cors: { origin: "http://localhost:3000" },
    });
    var counter = 0;
    io.on("connection", (socket) => {
        console.log("connected");
        socket.on('create_room', (data, callback) => {
            const roomId = Math.random().toString(36).substring(2, 8).toUpperCase();
            socket.join(roomId);
            console.log(`created room: ${data.name}`);
            counter++;
            callback({
                success: true,
                roomId: roomId,
                error: false
            });
        });
socket.on('join_room', (data, callback) => {
    const roomCode = data.code.toString();
    const roomExists = io.sockets.adapter.rooms.has(roomCode);
    
    if (roomExists) {
        // 1. Check if the user is ALREADY in the room
        if (!socket.rooms.has(roomCode)) {
            // 2. If they are not, join them and broadcast to others
            socket.join(roomCode);
            io.to(roomCode).emit("user_join", data.name);
            counter++; 
        } else {
            console.log(`${data.name} tried to join but is already in the room.`);
        }
        
        // 3. Always fire the callback so the frontend UI updates to "Rooms ID: ..."
        callback({
            success: true,
            roomId: roomCode,
            error: false
        });
    } else {
        // Room doesn't exist
        callback({
            success: false,
            roomId: roomCode,
            error: true
        });
    }
});
    });
};
start();
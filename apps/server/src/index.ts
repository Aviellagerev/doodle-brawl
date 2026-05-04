import Fastify from "fastify";
import { Server } from "socket.io";
const app = Fastify({ logger: true });
app.get("/health", async () => ({ ok: true }));
const start = async () => {
    await app.listen({ port: 3001, host: "0.0.0.0" });
    const io = new Server(app.server, {
        cors: { origin: "http://localhost:3000" },
    });
    var counter=0;
    io.on("connection", (socket) => {


        app.log.info(`client connected: ${socket.id}`);
        socket.on("ping", (payload, callback) => {
            counter++;
            callback({ counter,pong: true, echo: payload });
            io.emit("pong",counter);
            
        });
    });
};
start();
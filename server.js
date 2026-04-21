console.log("SERVER FILE IS RUNNING");
const express = require("express");
const app = express();
const http = require("http").createServer(app);
const io = require("socket.io")(http);

console.log("SERVER STARTED");

app.use(express.json());
app.use(express.static("public"));

let users = {};

app.post("/register", (req, res) => {
    const { name, callcode } = req.body;

    if (users[callcode]) {
        return res.send({ success: false, message: "Callcode taken" });
    }

    users[callcode] = { name, socketId: null };
    res.send({ success: true, message: "Registered!" });
});

io.on("connection", (socket) => {

    socket.on("login", ({ callcode }) => {
        if (users[callcode]) {
            users[callcode].socketId = socket.id;
            socket.callcode = callcode;
        }
    });

    socket.on("call-user", ({ targetCallcode, offer }) => {
        const target = users[targetCallcode];

        if (!target || !target.socketId) {
            socket.emit("user-not-found");
            return;
        }

        io.to(target.socketId).emit("incoming-call", {
            from: socket.callcode,
            offer
        });
    });

    socket.on("answer-call", ({ to, answer }) => {
        const target = users[to];
        if (target?.socketId) {
            io.to(target.socketId).emit("call-answered", answer);
        }
    });

    socket.on("ice-candidate", ({ to, candidate }) => {
        const target = users[to];
        if (target?.socketId) {
            io.to(target.socketId).emit("ice-candidate", candidate);
        }
    });

    socket.on("disconnect", () => {
        if (socket.callcode && users[socket.callcode]) {
            users[socket.callcode].socketId = null;
        }
    });
});

http.listen(3000, () => {
    console.log("Server running on http://localhost:3000");
});
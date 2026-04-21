const express = require("express");
const app = express();
const http = require("http").createServer(app);
const io = require("socket.io")(http);
const path = require("path");

app.use(express.json());
app.use(express.static("public"));

app.get("/", (req, res) => {
    res.sendFile(path.join(__dirname, "public", "index.html"));
});

// callcode → socket.id
let users = {};

io.on("connection", (socket) => {

    socket.on("chat-message", ({ to, message, from }) => {
    const targetSocket = users[to];

    if (targetSocket) {
        io.to(targetSocket).emit("chat-message", {
            message,
            from
        });
    }
});

    console.log("User connected:", socket.id);

    // LOGIN
    socket.on("login", ({ callcode }) => {
        users[callcode] = socket.id;
        socket.callcode = callcode;

        console.log("Logged in:", callcode);
    });

    // CALL
    socket.on("call-user", ({ targetCallcode, offer }) => {
        const targetSocket = users[targetCallcode];

        if (!targetSocket) {
            socket.emit("user-not-found");
            return;
        }

        io.to(targetSocket).emit("incoming-call", {
            from: socket.callcode,
            offer
        });
    });

    // ANSWER
    socket.on("answer-call", ({ to, answer }) => {
        const targetSocket = users[to];

        if (targetSocket) {
            io.to(targetSocket).emit("call-answered", answer);
        }
    });

    // ICE
    socket.on("ice-candidate", ({ to, candidate }) => {
        const targetSocket = users[to];

        if (targetSocket) {
            io.to(targetSocket).emit("ice-candidate", candidate);
        }
    });

    // DISCONNECT
    socket.on("disconnect", () => {
        if (socket.callcode) {
            delete users[socket.callcode];
        }
    });
});

const PORT = process.env.PORT || 3000;
http.listen(PORT, () => {
    console.log("Server running on port", PORT);
});

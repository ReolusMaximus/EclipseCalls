console.log("SERVER FILE IS RUNNING");
const express = require("express");
const app = express();
const http = require("http").createServer(app);
const io = require("socket.io")(http);

console.log("SERVER STARTED");

app.use(express.json());
app.use(express.static("public"));

app.get("/", (req, res) => {
    res.sendFile(__dirname + "/public/index.html");
});

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
    if (!users[callcode]) {
        users[callcode] = {};
    }

    users[callcode].socketId = socket.id;
    socket.callcode = callcode;

    console.log("User logged in:", callcode);
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
    const targetSocket = users[to]?.socketId;

    if (targetSocket) {
        io.to(targetSocket).emit("call-answered", answer);
    }
});

    socket.on("ice-candidate", async (candidate) => {
    try {
        const ice = new RTCIceCandidate(candidate);

        if (peer && peer.remoteDescription) {
            await peer.addIceCandidate(ice);
            console.log("ICE applied immediately");
        } else {
            console.log("Queueing ICE candidate");
            pendingCandidates.push(ice);
        }
    } catch (err) {
        console.error("ICE error:", err);
    }
});

    socket.on("disconnect", () => {
        if (socket.callcode && users[socket.callcode]) {
            users[socket.callcode].socketId = null;
        }
    });
});

const PORT = process.env.PORT || 3000;

http.listen(PORT, () => {
    console.log("Server running on port", PORT);
});

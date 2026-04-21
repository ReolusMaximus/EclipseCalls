console.log("APP LOADED");

const socket = io();

let localStream;
let peer;
let currentCallUser;
let pendingCandidates = [];

const localVideo = document.getElementById("localVideo");
const remoteVideo = document.getElementById("remoteVideo");

window.onload = () => {
    startMedia();
};

// ---------------- MEDIA ----------------
async function startMedia() {
    try {
        localStream = await navigator.mediaDevices.getUserMedia({
            video: true,
            audio: true
        });

        localVideo.srcObject = localStream;
        console.log("MEDIA READY");

    } catch (err) {
        console.error("Camera error:", err);
    }
}

// ---------------- REGISTER ----------------
async function register() {
    const name = document.getElementById("name").value;
    const callcode = document.getElementById("callcode").value;

    await fetch("/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, callcode })
    });
}

// ---------------- LOGIN ----------------
function login() {
    const callcode = document.getElementById("callcode").value;

    socket.emit("login", { callcode });

    document.getElementById("login").style.display = "none";
    document.getElementById("callUI").style.display = "block";
}

// ---------------- PEER ----------------
function createPeer() {
    peer = new RTCPeerConnection({
        iceServers: [
            { urls: "stun:stun.l.google.com:19302" }
        ]
    });

    localStream.getTracks().forEach(track => {
        peer.addTrack(track, localStream);
    });

    peer.ontrack = (event) => {
        remoteVideo.srcObject = event.streams[0];
    };

    peer.onicecandidate = (event) => {
        if (event.candidate && currentCallUser) {
            socket.emit("ice-candidate", {
                to: currentCallUser,
                candidate: event.candidate
            });
        }
    };
}

// ---------------- CALL ----------------
async function callUser() {
    const target = document.getElementById("target").value;

    currentCallUser = target;

    createPeer();

    const offer = await peer.createOffer();
    await peer.setLocalDescription(offer);

    socket.emit("call-user", {
        targetCallcode: target,
        offer
    });

    console.log("CALL SENT");
}

// ---------------- INCOMING ----------------
socket.on("incoming-call", async ({ from, offer }) => {
    console.log("INCOMING CALL:", from);

    currentCallUser = from;

    window.incomingOffer = offer;

    document.getElementById("incoming").style.display = "block";
});

// ---------------- ACCEPT ----------------
async function acceptCall() {
    console.log("ACCEPT CLICKED");

    createPeer();

    await peer.setRemoteDescription(
        new RTCSessionDescription(window.incomingOffer)
    );

    // apply queued ICE
    pendingCandidates.forEach(c => {
        peer.addIceCandidate(new RTCIceCandidate(c));
    });
    pendingCandidates = [];

    const answer = await peer.createAnswer();
    await peer.setLocalDescription(answer);

    socket.emit("answer-call", {
        to: currentCallUser,
        answer
    });
}

// ---------------- ANSWER RECEIVED ----------------
socket.on("call-answered", async (answer) => {
    console.log("CALL ANSWER RECEIVED");

    await peer.setRemoteDescription(
        new RTCSessionDescription(answer)
    );

    pendingCandidates.forEach(c => {
        peer.addIceCandidate(new RTCIceCandidate(c));
    });
    pendingCandidates = [];
});

// ---------------- ICE ----------------
socket.on("ice-candidate", async (candidate) => {
    try {
        const ice = new RTCIceCandidate(candidate);

        if (peer && peer.remoteDescription) {
            await peer.addIceCandidate(ice);
        } else {
            pendingCandidates.push(ice);
        }
    } catch (err) {
        console.error("ICE error:", err);
    }
});

// ---------------- GLOBAL EXPORT ----------------
window.callUser = callUser;
window.acceptCall = acceptCall;
window.login = login;
window.register = register;

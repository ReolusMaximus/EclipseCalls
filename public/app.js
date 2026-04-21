let pendingCandidates = [];
console.log("APP JS LOADED");
const socket = io();

let localStream;
let peer;
let currentCallTarget;

const localVideo = document.getElementById("localVideo");
const remoteVideo = document.getElementById("remoteVideo");

window.onload = () => {
    console.log("PAGE LOADED");
    startMedia();
};

async function startMedia() {
    console.log("startMedia CALLED");

    try {
        localStream = await navigator.mediaDevices.getUserMedia({
            video: true,
            audio: true
        });

        console.log("MEDIA READY");

        localVideo.srcObject = localStream;

    } catch (err) {
        console.error("Media error FULL:", err);
    }
}


async function register() {
    const name = document.getElementById("name").value;
    const callcode = document.getElementById("callcode").value;

    const res = await fetch("/register", {
        method: "POST",
        headers: {"Content-Type":"application/json"},
        body: JSON.stringify({ name, callcode })
    });

    const data = await res.json();
    alert(data.message);
}

function login() {
    const callcode = document.getElementById("callcode").value;
    socket.emit("login", { callcode });

    document.getElementById("login").style.display = "none";
    document.getElementById("callUI").style.display = "block";
}

async function createPeer() {
   peer = new RTCPeerConnection({
    iceServers: [
        { urls: "stun:stun.l.google.com:19302" }
    ]
});

    localStream.getTracks().forEach(track => {
        peer.addTrack(track, localStream);
    });

    peer.ontrack = e => {
        remoteVideo.srcObject = e.streams[0];
    };

    peer.onicecandidate = e => {
        if (e.candidate) {
            socket.emit("ice-candidate", {
                to: currentCallTarget,
                candidate: e.candidate
            });
        }
    };
}

async function callUser() {
    const target = document.getElementById("target").value;

    if (!target) {
        alert("Enter a callcode");
        return;
    }

    // 🚨 NEW CHECK (this fixes your error)
    if (!localStream) {
        alert("Camera not ready yet!");
        console.log("localStream is undefined");
        return;
    }

    currentCallTarget = target;

    console.log("CALL START →", target);

    await createPeer();

    const offer = await peer.createOffer();
    await peer.setLocalDescription(offer);

    socket.emit("call-user", {
        targetCallcode: target,
        offer
    });
}

socket.on("incoming-call", ({ from, offer }) => {
    currentCallTarget = from;
    window.incomingOffer = offer;

    document.getElementById("incoming").style.display = "block";
    document.getElementById("caller").innerText = from + " is calling...";
});

async function acceptCall() {
    console.log("ACCEPT CLICKED");

    await createPeer();

    // ✅ FIRST: set remote description
    await peer.setRemoteDescription(
        new RTCSessionDescription(window.incomingOffer)
    );

    console.log("REMOTE DESCRIPTION SET");

    // ✅ THEN apply queued ICE candidates
    pendingCandidates.forEach(candidate => {
        peer.addIceCandidate(new RTCIceCandidate(candidate));
    });
    pendingCandidates = [];

    console.log("ICE CANDIDATES APPLIED");

    // ✅ THEN continue
    const answer = await peer.createAnswer();
    await peer.setLocalDescription(answer);

    socket.emit("answer-call", {
        to: currentCallTarget,
        answer
    });
}

socket.on("call-answered", async (answer) => {
    console.log("CALL ANSWER RECEIVED");

    await peer.setRemoteDescription(new RTCSessionDescription(answer));

    console.log("REMOTE SET ON CALLER");

    // Apply queued ICE candidates
    pendingCandidates.forEach(c => {
        peer.addIceCandidate(new RTCIceCandidate(c));
    });

    pendingCandidates = [];

    console.log("CALLER ICE APPLIED");
});

socket.on("ice-candidate", (candidate) => {
    if (peer && peer.remoteDescription) {
        peer.addIceCandidate(new RTCIceCandidate(candidate));
    } else {
        console.log("Queueing ICE candidate");
        pendingCandidates.push(candidate);
    }
});

window.acceptCall = acceptCall;
window.callUser = callUser;

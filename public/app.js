console.log("APP JS LOADED");
const socket = io();

let localStream;
let peer;
let currentCallTarget;

// Video elements — now inside the call stage
const localVideo  = document.querySelector('.local-pip video');
const remoteVideo = document.getElementById('remoteVideo');

window.onload = () => {
    console.log("PAGE LOADED");
    startMedia();
};

async function startMedia() {
    console.log("startMedia CALLED");
    try {
        localStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
        console.log("MEDIA READY");
        if (localVideo) localVideo.srcObject = localStream;
    } catch (err) {
        console.error("Media error:", err);
    }
}

async function createPeer() {
    peer = new RTCPeerConnection();

    localStream.getTracks().forEach(track => peer.addTrack(track, localStream));

    peer.ontrack = e => {
        remoteVideo.srcObject = e.streams[0];
    };

    peer.onicecandidate = e => {
        if (e.candidate) {
            socket.emit('ice-candidate', { to: currentCallTarget, candidate: e.candidate });
        }
    };
}

async function callUser() {
    const target = document.getElementById('target').value.trim();
    if (!target) return flash('Enter a callcode.');
    if (!localStream) return flash('Camera not ready yet!');

    currentCallTarget = target;
    console.log('CALL START →', target);

    await createPeer();

    const offer = await peer.createOffer();
    await peer.setLocalDescription(offer);

    socket.emit('call-user', { targetCallcode: target, offer });
}

async function acceptCall() {
    await createPeer();
    await peer.setRemoteDescription(new RTCSessionDescription(window.incomingOffer));
    const answer = await peer.createAnswer();
    await peer.setLocalDescription(answer);
    socket.emit('answer-call', { to: currentCallTarget, answer });
    // update local video src in PIP
    if (localVideo) localVideo.srcObject = localStream;
}

socket.on('call-answered', async (answer) => {
    await peer.setRemoteDescription(new RTCSessionDescription(answer));
    if (localVideo) localVideo.srcObject = localStream;
});

socket.on('ice-candidate', (candidate) => {
    if (peer) peer.addIceCandidate(new RTCIceCandidate(candidate));
});

socket.on('user-not-found', () => {
    flash('User not found or offline.');
});

// End call: notify remote peer then clean up
socket.on('call-ended', () => {
    cleanupCall();
    if (typeof showScreen === 'function') showScreen('screen-call');
});

function cleanupCall() {
    if (peer) { peer.close(); peer = null; }
    remoteVideo.srcObject = null;
}

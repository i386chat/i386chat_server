"use strict";

let userData = {};
let clientData = {
    lastPM: 0,
    room: "general",
    ignored: [],
    connected: true
}

const socket = io();

socket.on("user_connection", () => {
    if(clientData.connected == false) return;
    userData = {
        nickName: prompt("What is your nickname?", "Anonymous") || "Anonymous",
        bio: "I am a i386chat user."
    };
    socket.emit("userData_init", userData);
});

socket.on('chat_message', (data) => {
    $("#messages").append($(`<li><span  style="color:#${data.userData.colour}">${data.userData.nickName}</span> >> ${data.content}</li>`));
});

socket.on('user_update', (data) => {
    switch(data.type) {
        case "join":
            $("#messages").append($(`<li><span style="color:#${data.user.colour}">${data.user.nickName}</span> joined.</li>`));
        break;
        case "leave":
            $("#messages").append($(`<li><span style="color:#${data.user.colour}">${data.user.nickName}</span> left.</li>`));
        break;
        default:
            console.log("Receieved unknown user_update.");
        break;
    }
});

$('form').submit((event) => {
    event.preventDefault();
    let message = $("#m").val();
    socket.emit("chat_message", {
        content: message,
        userData, 
        room: clientData.room
    });
    $("#m").val("");
    return;
});

socket.on('userData_local', (data) => {
    userData = data;
});
"use strict";

let userData = {};
let clientData = {
    lastPM: 0,
    room: "general",
    ignored: [],
    connected: true
}

function append(data) {
    $("#messages").append($(`<li>`).text(data));
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
    let onclick_text = `onclick="append('ID: ${data.userData.userID} - ${data.userData.bio}')"`
    $("#messages").append($(`<li><span ${onclick_text} style="color:#${data.userData.colour}">${data.userData.nickName}</span> >> ${data.content}</li>`));
});

socket.on('command_output', (data) => {
    append(data.text);
});

socket.on('user_update', (data) => {
    switch(data.type) {
        case "join":
            $("#messages").append($(`<li><span style="color:#${data.user.colour}">${data.user.nickName}</span> joined.</li>`));
        break;
        case "leave":
            $("#messages").append($(`<li><span style="color:#${data.user.colour}">${data.user.nickName}</span> left.</li>`));
        break;
        case "nickChange":
            $("#messages").append($(`<li><span style="color:#${data.user.colour}">${data.oldName}</span> is now <span style="color:#${data.user.colour}">${data.newName}</span>.</li>`));
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
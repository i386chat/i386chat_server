"use strict";
/* 
i386chat_server rewrite
2020 zer0char1sma, xFuney, mckinley

Hopefully this will be better.
*/

// Libraries
const express = require("express"),
    app = express(),
    http = require("http").createServer(app),
    io = require("socket.io")(http),
    xss = require("xss"),
    path = require("path"),
    config = require("./common/config.json");

// Constants
let onlineUsers = 0;
let userData = {};
let rooms = ["general"];
let messageDelay = new Set();
let privateMessageDelay = new Set();

// Express. It should hopefully work fine.
app.use("/", express.static('./app/web/'));

io.on('connection', async (socket) => {
    console.log(`[DEBUG]: Socket ${socket.id} connected.`)
    socket.join("general")
    socket.emit("user_connection", {
        onlineUsers
    });

    socket.on('chat_message', (data) => {
        console.log(`[DEBUG]: Socket ${socket.id} sent a chat_message packet.`);
        if (messageDelay.has(socket.id)) {
            return console.log(`[DEBUG]: Socket ${socket.id} is in the messageDelay list. Message ignored.`);
        }

        if (!userData[socket.id]) return console.log(`[DEBUG]: Socket ${socket.id} hasn't had their userData initialised and they're trying to send messages!`);
        data["userData"] = userData[socket.id];
        if (data["content"].length > 250) return console.log(`[DEBUG]: Socket ${socket.id} tried to send a message with more than 250 characters.`);
        data["content"] = xss(data["content"], config.xssFilter);
        
        messageDelay.add(socket.id);
        let sendToRoom = data["room"] || "general";

        io.to(sendToRoom.toLowerCase()).emit("chat_message", data);
        setTimeout(() => {
            messageDelay.delete(socket.id);
        }, 250);
    });

    socket.on("userData_change", (data) => {
        console.log(`[DEBUG]: Socket ${socket.id} sent a userData_change packet.`);

        switch(data.type) {

            case "nickname":
                let oldName = userData[socket.id]["nickName"];
                userData[socket.id]["nickName"] = xss(data.newNick.replace(/"/g, `\\"`), config.xssFilter);
                io.to("general").emit("user_update", {
                    type: "nickChange",
                    oldName,
                    newName: xss(data.newNick, config.xssFilter),
                    user: userData[socket.id]
                });
            break;

            case "bio":
                if(!data.bio || data.bio.length > 125) return console.log(`[DEBUG]: Socket ${socket.id} tried to update their bio with a null value or a bio with more than 125 characters.`);    
                userData[socket.id]["bio"] = xss(data.bio.replace(/"/g, `\'`).replace(/'/g, `\\'`), config.xssFilter);
                socket.emit("command_output", {
                    text: "Bio updated."
                })
            break;

            default:
            console.log(`[DEBUG]: Socket ${socket.id} sent an unknown userData_change type.`)
            break;

        }

    });

    socket.on("userData_init", (data) => {
        console.log(`[DEBUG]: Socket ${socket.id} sent a userData_init packet.`);
        if (userData[socket.id]) return console.log(`[DEBUG]: Socket ${socket.id} already has userData!`);

        onlineUsers += 1;
        userData[socket.id] = {
            "nickName": xss(data["nickName"], config.xssFilter),
            "colour": `${Math.floor(Math.random() * 16777216).toString(16)}`,
            "bio": xss(data["bio"].replace(/"/g, `\\"`).replace(/'/g, `\\'`), config.xssFilter),
            "userID": Math.floor(Math.random() * 9000000000) + 1000000000
        };

        io.to("general").emit("user_update", {
            user: userData[socket.id],
            type: "join"
        });
        socket.emit("userData_local", userData[socket.id]);
    });
});

http.listen(3000);

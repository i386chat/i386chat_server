'use strict';

module.exports.startServer = function(express, app, http) {
    console.log(app);
   ,
    xss = require("xss"),
    path = require("path"),
    config = require("./common/config.json");

// Constants
let onlineUsers = 0;
let userData = {
    "userID_to_socketID": {
        nickName: "SYSTEM",
        userID: 1
    }
};
let rooms = ["general"];
let messageDelay = new Set();
let privateMessageDelay = new Set();
let moderation = {
    godUsers: [],
    bannedIPs: [],
    banReasons: {
       
    },
    banIDs: 0,
    banReasonsDirect: {},
    mutedSockets: []
}

function arrayRemove(arr, value) {
    return arr.filter(function (ele) {
        return ele != value;
    });
};
function isEmpty(s) {
    return (s.length === 0 || !s.trim());
};

// Express. It should hopefully work fine.
app.use("/", express.static('./web/'));

io.on('connection', async (socket) => {
    console.log(`[DEBUG]: Socket ${socket.id} connected.`);

    if (moderation.bannedIPs.includes(socket.request.connection.remoteAddress)) {
        console.log(`[DEBUG]: Socket ${socket.id} is banned.`);
        socket.join("general");
        socket.emit("user_connection", {
            banned: true,
            reason: moderation.banReasonsDirect[socket.request.connection.remoteAddress],
            onlineUsers
        });
        socket.disconnect();
        return;
    }

    socket.join("general");
    socket.emit("user_connection", {
        onlineUsers
    });


    socket.on('disconnect', (data) => {
        console.log(`[DEBUG]: Socket ${socket.id} disconnected.`);
        if (!userData[socket.id]) return console.log(`[DEBUG]: Socket ${socket.id} had no userData.`);
        if (moderation.godUsers.includes(socket.id)) userData[socket.id]["admin"] = true;
        else userData[socket.id]["admin"] = false;

        io.to(userData[socket.id].currentRoom).emit("user_update", {
            user: userData[socket.id],
            type: "leave"
        });
        delete userData[socket.id];
        delete moderation.godUsers[socket.id];
        delete moderation.mutedSockets[socket.id];

        if (messageDelay.has(socket.id)) messageDelay.delete(socket.id);
        onlineUsers -= 1;
    });

    socket.on('chat_message', (data) => {
        console.log(`[DEBUG]: Socket ${socket.id} sent a chat_message packet.`);
        if (messageDelay.has(socket.id)) {
            return console.log(`[DEBUG]: Socket ${socket.id} is in the messageDelay list. Message ignored.`);
        }

        if (!userData[socket.id]) return console.log(`[DEBUG]: Socket ${socket.id} hasn't had their userData initialised and they're trying to send messages!`);
        data["userData"] = userData[socket.id];
        if (data["content"].length > 250) return console.log(`[DEBUG]: Socket ${socket.id} tried to send a message with more than 250 characters.`);
        if(isEmpty(data["content"])) return console.log(`[DEBUG]: Socket ${socket.id} tried to send an empty message.`)
        data["content"] = xss(data["content"], config.xssFilter);
        if (moderation.godUsers.includes(socket.id)) data["userData"]["admin"] = true;
        else data["userData"]["admin"] = false;

        if (moderation.mutedSockets.includes(socket.id)) return console.log(`[DEBUG]: Socket ${socket.id} tried to send a message, but is muted.`);

        messageDelay.add(socket.id);

        io.to(userData[socket.id].currentRoom).emit("chat_message", data);
        setTimeout(() => {
            messageDelay.delete(socket.id);
        }, 250);
    });

    socket.on('chat_private_message', (data) => {
        console.log(`[DEBUG]: Socket ${socket.id} sent a chat_private_message packet.`);
        if (privateMessageDelay.has(socket.id)) {
            return console.log(`[DEBUG]: Socket ${socket.id} is in the privateMessageDelay list. Message ignored.`);
        }

        if (!userData[socket.id]) return console.log(`[DEBUG]: Socket ${socket.id} hasn't had their userData initialised and they're trying to send messages!`);
        data["userData"] = userData[socket.id];
        if (moderation.godUsers.includes(socket.id)) data["userData"]["admin"] = true;
        else data["userData"]["admin"] = false;

        if (data["content"].length > 250) return console.log(`[DEBUG]: Socket ${socket.id} tried to send a message with more than 250 characters.`);
        if(isEmpty(data["content"])) return console.log(`[DEBUG]: Socket ${socket.id} tried to send an empty message.`)
        data["content"] = xss(data["content"], config.xssFilter);

        if (!data["receiverID"]) return console.log(`[DEBUG]: Socket ${socket.id} tried to send a private message, but specified no receiverID parameter.`);

        if (moderation.mutedSockets.includes(socket.id)) return console.log(`[DEBUG]: Socket ${socket.id} tried to send a private message, but is muted.`);

        privateMessageDelay.add(socket.id);
        io.to(userData["userID_to_socketID"][data["receiverID"]]).emit("chat_private_message", data);
        setTimeout(() => {
            privateMessageDelay.delete(socket.id);
        }, 250);
    })

    socket.on('user_command', (data) => {
        console.log(`[DEBUG]: Socket ${socket.id} sent a user_command packet.`);
        let command = data.command || "";
        switch (command) {
            case "listOnlineUsers":
                console.log(`[DEBUG]: Socket ${socket.id} wanted to know the online users.`);
                var res = [];
                for (var i in userData)
                    res.push({
                        nickName: userData[i].nickName,
                        colour: userData[i].colour,
                        id: userData[i].userID
                    });
                socket.emit("all_online_users", res)
                break;
            case "listAllRooms":
                console.log(`[DEBUG]: Socket ${socket.id} wanted to know the current rooms.`);
                let room_output = rooms.map(x => {
                    if(!x.startsWith("#")) {
                        return x;
                    } else {
                        return "-- hidden --";
                    }
                });
                socket.emit("command_output", {
                    text: `Rooms: ${room_output.join(", ")}.`
                });
                break;
            case "listAllCommands":
                let commandList = `//online, //room, //nick, //bio, //ignore, //whisper, //reply`
                if (moderation.godUsers.includes(socket.id)) commandList = commandList + ", //mute, //unmute, //ban, //kick, //bans, //unban"
                socket.emit("command_output", {
                    text: `Available commands: ${commandList}.`
                })
                break;
            case "kickUser":
                if (!data.userID) console.log(`[DEBUG]: Socket ${socket.id} sent an invalid kickUser packet.`);
                if (!data.reason) console.log(`[DEBUG]: Socket ${socket.id} sent an invalid kickUser packet.`);
                console.log(`[DEBUG]: Socket ${socket.id} is trying to kick socket ${userData["userID_to_socketID"][data.userID]}.`);
                if (!moderation.godUsers.includes(socket.id)) {
                    console.log(`[DEBUG]: Socket ${socket.id} is not in godUsers array.`);
                    socket.emit("command_output", {
                        text: `You do not have permission to do this command.`
                    });
                    return;
                }
                if (io.sockets.sockets[userData["userID_to_socketID"][data.userID]]) {
                    io.to(userData["userID_to_socketID"][data.userID]).emit("command_output", {
                        text: `You have been kicked for ${xss(data.reason, config.xssFilter)}.`
                    })
                    io.sockets.sockets[userData["userID_to_socketID"][data.userID]].disconnect();
                    socket.emit("command_output", {
                        text: `Kicked user ${data.userID}.`
                    });
                }
                break;
            case "banUser":
                if (!data.userID) console.log(`[DEBUG]: Socket ${socket.id} sent an invalid banUser packet.`);
                if (!data.reason) console.log(`[DEBUG]: Socket ${socket.id} sent an invalid banUser packet.`);
                console.log(`[DEBUG]: Socket ${socket.id} is trying to ban socket ${userData["userID_to_socketID"][data.userID]}.`);
                if (!moderation.godUsers.includes(socket.id)) {
                    console.log(`[DEBUG]: Socket ${socket.id} is not in godUsers array.`);
                    socket.emit("command_output", {
                        text: `You do not have permission to do this command.`
                    });
                    return;
                }
                if (io.sockets.sockets[userData["userID_to_socketID"][data.userID]]) {
                    io.to(userData["userID_to_socketID"][data.userID]).emit("command_output", {
                        text: `You have been banned for reason: ${data.reason}.`
                    })
                    moderation.banReasons[moderation.banIDs + 1] = {
                        reason: xss(data.reason, config.xssFilter),
                        ip: io.sockets.sockets[userData["userID_to_socketID"][data.userID]].request.connection.remoteAddress,
                        id: moderation.banIDs + 1,
                        username: userData[userData["userID_to_socketID"][data.userID]].nickName,
                        userID: userData[userData["userID_to_socketID"][data.userID]].userID
                    };
                    moderation.banIDs = moderation.banIDs + 1;
                    moderation.banReasonsDirect[io.sockets.sockets[userData["userID_to_socketID"][data.userID]].request.connection.remoteAddress] = data.reason;
                    moderation.bannedIPs.push(io.sockets.sockets[userData["userID_to_socketID"][data.userID]].request.connection.remoteAddress);
                    io.sockets.sockets[userData["userID_to_socketID"][data.userID]].disconnect();
                    socket.emit("command_output", {
                        text: `Banned user ${data.userID}.`
                    });
                }
                break;
            case "unbanUser":
                if (!data.id) console.log(`[DEBUG]: Socket ${socket.id} sent an invalid unbanUser packet.`);
                console.log(`[DEBUG]: Socket ${socket.id} is trying to unban ${data.id}.`);
                if (!moderation.godUsers.includes(socket.id)) {
                    console.log(`[DEBUG]: Socket ${socket.id} is not in godUsers array.`);
                    socket.emit("command_output", {
                        text: `You do not have permission to do this command.`
                    });
                    return;
                }
                if (moderation.banReasons[data.id]) {
                    moderation.bannedIPs = arrayRemove(moderation.bannedIPs, moderation.banReasons[data.id].ip);
                    moderation.banReasons[data.id]["ip"] = "[unbanned]";
                    moderation.banReasons[data.id]["reason"] = moderation.banReasons[data.id]["reason"] + "[unbanned]";

                    socket.emit("command_output", {
                        text: `Unbanned user.`
                    });
                }
                break;
            case "listBans":
                console.log(`[DEBUG]: Socket ${socket.id} is trying to list all bans.`);
                if (!moderation.godUsers.includes(socket.id)) {
                    console.log(`[DEBUG]: Socket ${socket.id} is not in godUsers array.`);
                    socket.emit("command_output", {
                        text: `You do not have permission to do this command.`
                    });
                    return;
                }
                console.log(moderation.banReasons);
                var res = [];
                for (var i in moderation.banReasons)
                    res.push(moderation.banReasons[i].id + ` for: ${moderation.banReasons[i].reason} (uid: ${moderation.banReasons[i].userID}, username: ${moderation.banReasons[i].username}).`);
                socket.emit("command_output", {
                    text: `${res.join(",\n")}`
                });

                break;
            case "muteUser":
                if (!data.userID) console.log(`[DEBUG]: Socket ${socket.id} sent an invalid muteUser packet.`);
                if (!data.reason) console.log(`[DEBUG]: Socket ${socket.id} sent an invalid muteUser packet.`);

                console.log(`[DEBUG]: Socket ${socket.id} is trying to mute socket ${userData["userID_to_socketID"][data.userID]}.`);
                if (!moderation.godUsers.includes(socket.id)) {
                    console.log(`[DEBUG]: Socket ${socket.id} is not in godUsers array.`);
                    socket.emit("command_output", {
                        text: `You do not have permission to do this command.`
                    });
                    return;
                }
                if (io.sockets.sockets[userData["userID_to_socketID"][data.userID]]) {
                    io.to(userData["userID_to_socketID"][data.userID]).emit("command_output", {
                        text: `You have been muted for ${xss(data.reason, config.xssFilter)}.`
                    })
                    moderation.mutedSockets.push(userData["userID_to_socketID"][data.userID]);
                    socket.emit("command_output", {
                        text: `Muted user ${data.userID}.`
                    });
                }
                break;
            case "unmuteUser":
                if (!data.userID) console.log(`[DEBUG]: Socket ${socket.id} sent an invalid unmuteUser packet.`);
                console.log(`[DEBUG]: Socket ${socket.id} is trying to unmute socket ${userData["userID_to_socketID"][data.userID]}.`);
                if (!moderation.godUsers.includes(socket.id)) {
                    console.log(`[DEBUG]: Socket ${socket.id} is not in godUsers array.`);
                    socket.emit("command_output", {
                        text: `You do not have permission to do this command.`
                    });
                    return;
                }
                if (io.sockets.sockets[userData["userID_to_socketID"][data.userID]]) {
                    moderation.mutedSockets = arrayRemove(moderation.mutedSockets, userData["userID_to_socketID"][data.userID])
                    socket.emit("command_output", {
                        text: `Unmuted user ${data.userID}.`
                    });
                }
                break;
            default:
                socket.emit("command_output", {
                    text: `Is someone tinkering in the console?`
                });
                break;
        }
    });

    socket.on("godMode_enable", (data) => {
        console.log(`[DEBUG]: Socket ${socket.id} sent a godMode_enable packet.`);
        if (!data.code) return console.log(`[DEBUG]: Socket ${socket.id} tried to enable godMode, but specified no code.`);
        if (data.code == config.godModeCode) {
            socket.emit("command_output", {
                text: "You are now an admin."
            });
            moderation.godUsers.push(socket.id);
        } else {
            console.log(`[DEBUG]: Socket ${socket.id} tried to enable godMode, but specified a wrong code.`);
            socket.emit("command_output", {
                text: "I mean you tried, that's all that counts right?"
            });
        }
    });

    socket.on("userData_change", (data) => {
        console.log(`[DEBUG]: Socket ${socket.id} sent a userData_change packet.`);

        switch (data.type) {

            case "nickName":
                console.log(`[DEBUG]: Socket ${socket.id} is changing their nickname.`)
				var newNick = data.newNick;
                if(data.newNick.length > 16) {
					console.log(`[DEBUG]: Socket ${socket.id}'s nickname change is too long, shortening!'`);
					socket.emit("command_output", {
						text: "Your nickname was too long, so it was shortened to 16 characters."
					})
                	newNick = data.newNick.substring(0, 16);
                };
                let oldName = userData[socket.id]["nickName"];
                userData[socket.id]["nickName"] = xss(newNick.replace(/"/g, `\\"`), config.nickFilter);
                socket.emit("userData_local", userData[socket.id]);

                if (moderation.mutedSockets.includes(socket.id)) return console.log(`[DEBUG]: Socket ${socket.id} is muted.`);

                io.to(userData[socket.id].currentRoom).emit("user_update", {
                    type: "nickChange",
                    oldName,
                    newName: xss(newNick, config.nickFilter),
                    user: userData[socket.id]
                });
                break;

            case "bio":
                console.log(`[DEBUG]: Socket ${socket.id} is updating their bio.`)
                if (!data.bio || data.bio.length > 125) return console.log(`[DEBUG]: Socket ${socket.id} tried to update their bio with a null value or a bio with more than 125 characters.`);
                userData[socket.id]["bio"] = xss(data.bio.replace(/"/g, `\'`).replace(/'/g, `\\'`), config.xssFilter);
                socket.emit("userData_local", userData[socket.id]);
                socket.emit("command_output", {
                    text: "Bio updated."
                });
                break;

            case "room":
                console.log(`[DEBUG]: Socket ${socket.id} is moving rooms.`)
                if (moderation.mutedSockets.includes(socket.id)) return console.log(`[DEBUG]: Socket ${socket.id} is muted and can't move rooms.`);

                if (!rooms.includes(data.newRoom)) rooms.push(data.newRoom);

                let oldRoom = userData[socket.id].currentRoom;
                socket.leave(oldRoom);
                io.to(oldRoom).emit("user_update", {
                    type: "leaveRoom",
                    oldRoom,
                    user: userData[socket.id]
                });
                socket.join(data.newRoom);
                io.to(data.newRoom).emit("user_update", {
                    type: "joinRoom",
                    newRoom: data.newRoom,
                    user: userData[socket.id]
                });
                userData[socket.id]["currentRoom"] = data.newRoom;
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
            "nickName": xss(data["nickName"].substring(0, 16), config.nickFilter),
            "colour": `${Math.floor(Math.random() * 16777216).toString(16)}`,
            "bio": xss(data["bio"].replace(/"/g, `\\"`).replace(/'/g, `\\'`), config.xssFilter),
            "userID": Math.floor(Math.random() * 9000000000) + 1000000000,
            "currentRoom": "general"
        };

        userData["userID_to_socketID"][userData[socket.id].userID] = socket.id;
        if (moderation.godUsers.includes(socket.id)) userData[socket.id]["admin"] = true;
        else userData[socket.id]["admin"] = false;

        io.to(userData[socket.id].currentRoom).emit("user_update", {
            user: userData[socket.id],
            type: "join"
        });
        socket.emit("userData_local", userData[socket.id]);
    });
});

}
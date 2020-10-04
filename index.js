'use strict';

// Codename Char1sma
// Funey/Zer0char1sma 2020

// As Discord API compliant as possible.

// Configuration stuff. The end user can touch this if they wish. //

const CONFIG = require('./global_config')

// The end user will only have god on his side after treading past this comment ... //

// Initialise Express varaibles, and start the primary Router.
const Express = require('express');
var bodyParser = require('body-parser')
const app = Express();
const http = require("http").createServer(app);

// Initialise stuff for parsing.

// parse application/x-www-form-urlencoded
app.use(bodyParser.urlencoded({ extended: false }))
 
// parse application/json
app.use(bodyParser.json())

// Initialise i386chat libraries.
const io = require("socket.io")(http);
const xss = require("xss");
const path = require("path");
const config = require("./common/config.json");
const fs = require('fs');

// non-constant

let onlineUsers = 0;

// Initialise stuff for JSON Web Tokens.
const jwt = require('jsonwebtoken');

// Initialise stuff for ratelimiting requests.
const rateLimit = require('express-rate-limit')({
    windowMs: 2500,
    max: 40,
    message: {"message": "You are being ratelimited.", "retryAfter": 2500, "global": false},
    headers: true,
});

// Tell Express to use rate-limiting middleware.
app.use(rateLimit);

// Define primary router.
const API_ROUTER = new Express.Router();
const USER_ROUTER = new Express.Router();



// Call in our Database API.
const DATABASE_API = require('./databases/' + CONFIG.DB_TYPE);
const AUTH_API = require('./auth')

// Call in the API Library, we'll use it to handle requests.
const API_LIBRARY = require('./api');
const { fstat } = require('fs');

function MW_Authenticate(req, res, next) {
    const authHeader = req.headers['authorization']
    const token = authHeader && authHeader.split(' ')[1]

    jwt.verify(token, CONFIG.JWT_SECRET, function(err, decoded) {
        if (err) return res.status(400).send({ 
            errors:{
                token: {
                    _errors: {
                        0: {
                            code: "TOKEN_INVALID",
                            message: "Token is invalid."
                        }
                    }
                }
            }
        });
        
        // TODO: Authentication Script, hooking into DB API.
        // TODO: Check user validity before sending them to their endpoint.
        if (DATABASE_API.checkUserExists(decoded.userId)) {
            req.userInfo = decoded;
            next();
        } else {
            // What the fuck?
            // What did the- how did they get our private key?
        }
        
    });
}


// Iterate through the library, 'name' should be equal to the request path RELATIVE TO THE ROOT OF API_LOCATION.
// Probably shouldn't be used for handling messages (for simple static stuff like user info)

for ( const name in API_LIBRARY ) {
    // Check what types of requests we're dealing with, and handle them accordingly.
    if ( API_LIBRARY[name].requestType == "POST" ) {
        // POST requests, probably proper API requests.
        if (API_LIBRARY[name].authenticationRequired) {
            // Need to use authentication middleware.
            API_ROUTER.post(CONFIG.API_LOCATION + name, MW_Authenticate, API_LIBRARY[name].requestFunction)
        } else {
            // No need for authentication middleware.
            API_ROUTER.post(CONFIG.API_LOCATION + name, API_LIBRARY[name].requestFunction)
        }
    } else if ( API_LIBRARY[name].requestType == "GET" ) {
        // Potentially someone browsing through, or malformed requests - depends on how you write the API.
        if (API_LIBRARY[name].authenticationRequired) {
            // Need to use authentication middleware.
            API_ROUTER.get(CONFIG.API_LOCATION + name, MW_Authenticate, API_LIBRARY[name].requestFunction)
        } else {
            // No need for authentication middleware.
            API_ROUTER.get(CONFIG.API_LOCATION + name, API_LIBRARY[name].requestFunction)
        }
    }
}

API_ROUTER.post(CONFIG.API_LOCATION + "rooms/:room/info", (req, res) => {
    if (!DATABASE_API.checkRoomExists(req.params.room)) return res.status(400).json({ code: 100, error: 'Room does not exist.'});

    let info = DATABASE_API.getRoomInfo(req.params.room)

    res.json(info)
})

API_ROUTER.post(CONFIG.API_LOCATION + "rooms/:room/messages/send", MW_Authenticate, (req, res) => {
    if (!DATABASE_API.checkRoomExists(req.params.room)) return res.status(400).json({ code: 100, error: 'Room does not exist.'});

    const authHeader = req.headers['authorization']
    const autharray = authHeader && authHeader.split(' ')
    if (autharray[0] == "User") {
        // Is a user, so send messages as a user.
        let user = AUTH_API.authenticateUser(autharray[1]);

        if (!user) return res.status(400).send({code: 0, error: "Invalid token."});

        let AddInfo = DATABASE_API.getUserInfo(user.userId);

        if (AddInfo.code) return res.status(400).send(AddInfo);
        
        let room = req.body.roomId || "R_9999";

        io.to(room).emit("command_output", {text: AddInfo.userName + " (HTTP) >> " + req.body.content});

        res.json({ status: 'OK' })
    } else {
        // Is a bot, so send messages as a bot.
        let user = AUTH_API.authenticateBot(autharray[1]);

        if (!user) return res.status(400).send({code: 0, error: "Invalid token."});

        let AddInfo = DATABASE_API.getBotInfo(user.botId);

        if (AddInfo.code) return res.status(400).send(AddInfo);
        
        let room = req.body.roomId || "R_9999";

        io.to(room).emit("command_output", {text: AddInfo.botName + " (BOT) >> " + req.body.content});

        res.json({ status: 'OK' })

    }
})

API_ROUTER.post(CONFIG.API_LOCATION + 'auth/create/user', (req,res) => {
    // Create user.
    let info = DATABASE_API.createUser(req.body.username, req.body.bio);

    // Throw new account to the user.
    res.json(info);
})

USER_ROUTER.post('/signup.html', (req,res) => {
    // User is signing up, check for query stuff.
    if (!req.body.userName && !req.body.userBio) return res.redirect('/signup.html');

    // Query stuff exists. Create their user.
    let NewUser = DATABASE_API.createUser(req.body.userName, req.body.userBio);

    // We now have their token, so present it to them.
    let data = fs.readFileSync(__dirname + "/sgn-complete.html", 'utf8').replace('%%TOKEN%%', NewUser).replace('%%TOKEN%%', NewUser);

    res.send(data);
})

// Test... Remove this later!
app.use("/", Express.static('./web/'));

// Websocketing time.


function arrayRemove(arr, value) {
    return arr.filter(function (ele) {
        return ele != value;
    });
};
function isEmpty(s) {
    return (s.length === 0 || !s.trim());
};

let userData = {
    "userID_to_socketID": {
        nickName: "SYSTEM",
        userID: "U_9999"
    }
};

let moderation = {
    godUsers: [],
    bannedIPs: [],
    banReasons: {
       
    },
    banIDs: 0,
    banReasonsDirect: {},
    mutedSockets: []
}

let messageDelay = new Set();
let privateMessageDelay = new Set();

io.on('connection', async (socket) => {
    console.log(`[WS-DBG] Socket ${socket.id} connected via Websocket.`)


    // Join user to default room.
    socket.join('R_9999');
    socket.emit("user_connection", {
        onlineUsers
    });

    socket.emit('command_output', {
        text: "This is a BETA SERVER for testing the new i386chat authentication/server modal."
    })

    socket.on("userData_init", (data) => {
        console.log(`[DEBUG]: Socket ${socket.id} sent a userData_init packet.`);
        if (userData[socket.id]) return console.log(`[DEBUG]: Socket ${socket.id} already has userData!`);

        let user = AUTH_API.authenticateUser(data.token);

        console.log(user)
        if (!user) { console.log("[DEBUG] User doesn't exist or error occurred, throwing away request."); socket.emit('command_output', {text: "Invalid token provided. Please reload and provide a valid token."}); return socket.disconnect(); }

        let userInfo = DATABASE_API.getUserInfo(user.userId);

        if (userInfo.code) {
            // Uh oh. User banned?
            if (userInfo.code == 99) {
                // User banned. Fucking RIP.
                console.log("[DEBUG]: Socket " + socket.id + " tried to log in as a banned user, disconnecting.");
                socket.emit('command_output', {text: "You have been banned from this chat server. Contact the System Administrator for more information."}); 
                return socket.disconnect();
            }
        }

        onlineUsers++;

        userData[socket.id] = {
            "nickName": xss(userInfo.userName, config.nickFilter),
            "colour": `${Math.floor(Math.random() * 16777216).toString(16)}`,
            "bio": xss(userInfo.userBio.replace(/"/g, `\\"`).replace(/'/g, `\\'`), config.xssFilter),
            "userID": user.userId,
            "currentRoom": "R_9999"
        };

        userData["userID_to_socketID"][userData[socket.id].userID] = socket.id;
        //if (moderation.godUsers.includes(socket.id)) userData[socket.id]["admin"] = true;
        

        io.to(userData[socket.id].currentRoom).emit("user_update", {
            user: userData[socket.id],
            type: "join"
        });

        if (DATABASE_API.isUserGod(user.userId)) {
            socket.emit("command_output", {text: "You are in GOD MODE - moderation commands are available to you."});
            moderation.godUsers += socket.id;
            userData[socket.id]["admin"] = true;
        }

        console.log(`[DEBUG]: Socket ${socket.id} successfully sent user data.`)
        socket.emit("userData_local", userData[socket.id]);
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
        //if (moderation.godUsers.includes(socket.id)) data["userData"]["admin"] = true;
        //else data["userData"]["admin"] = false;

        if (moderation.godUsers.includes(socket.id)) data["userData"]["admin"] = true; else data["userData"]["admin"] = false;

        if (moderation.mutedSockets.includes(socket.id)) return console.log(`[DEBUG]: Socket ${socket.id} tried to send a message, but is muted.`);

        messageDelay.add(socket.id);

        io.to(userData[socket.id].currentRoom).emit("chat_message", data);
        setTimeout(() => {
            messageDelay.delete(socket.id);
        }, 250);
    });


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

                let getallroom = DATABASE_API.getAllRooms();

                let room_output = getallroom.map(x => {
                    if (x.visibility == 1) {
                        return x.roomId + " (name: " + x.roomName + ")"
                    } else {
                        return x.roomId + " (private channel)"
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

                var banning;

                try {
                    banning = DATABASE_API.banUser(userData[userData["userID_to_socketID"][data.userID]].userID);
                } catch (err) {
                    banning = {code:0}
                }

                if (banning.code) {
                    // Error?
                    if (banning.code == 0) {
                        return socket.emit("command_output", {
                            text: `User ${userData[userData["userID_to_socketID"][data.userID]].userID} does not exist.`
                        });
                    } else if (banning.code == 60) {
                        return socket.emit("command_output", {
                            text: `Banning of user ${userData[userData["userID_to_socketID"][data.userID]].userID} failed due to a database error. Contact the System Administrator.`
                        });
                    }
                }


                if (io.sockets.sockets[userData["userID_to_socketID"][data.userID]]) {
                    io.to(userData["userID_to_socketID"][data.userID]).emit("command_output", {
                        text: `You have been banned for reason: ${data.reason}.`
                    })
                    //moderation.banReasons[moderation.banIDs + 1] = {
                        //reason: xss(data.reason, config.xssFilter),
                        //ip: io.sockets.sockets[userData["userID_to_socketID"][data.userID]].request.connection.remoteAddress,
                        //id: moderation.banIDs + 1,
                        //username: userData[userData["userID_to_socketID"][data.userID]].nickName,
                        //userID: userData[userData["userID_to_socketID"][data.userID]].userID
                    //};
                    //moderation.banIDs = moderation.banIDs + 1;
                    //moderation.banReasonsDirect[io.sockets.sockets[userData["userID_to_socketID"][data.userID]].request.connection.remoteAddress] = data.reason;
                    //moderation.bannedIPs.push(io.sockets.sockets[userData["userID_to_socketID"][data.userID]].request.connection.remoteAddress);
                    io.sockets.sockets[userData["userID_to_socketID"][data.userID]].disconnect();
                    socket.emit("command_output", {
                        text: `Banned user ${userData[userData["userID_to_socketID"][data.userID]].userID}.`
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

                var unbanning;
                
                try {
                    unbanning = DATABASE_API.unbanUser(data.id);
                } catch {
                    unbanning = {code: 0}
                }
                
                if (unbanning.code) {
                    // Error?
                    if (unbanning.code == 0) {
                        return socket.emit("command_output", {
                            text: `User ${data.userId} does not exist.`
                        });
                    } else if (unbanning.code == 60) {
                        return socket.emit("command_output", {
                            text: `Banning of user ${data.userId} failed due to a database error. Contact the System Administrator.`
                        });
                    }
                }

                socket.emit("command_output", {
                    text: `Unbanned user.`
                });

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

                let bans = DATABASE_API.getAllBanned();

                //console.log(moderation.banReasons);
                var res = [];
                for (var i in bans)
                    //res.push(moderation.banReasons[i].id + ` for: ${moderation.banReasons[i].reason} (uid: ${moderation.banReasons[i].userID}, username: ${moderation.banReasons[i].username}).`);
                    res.push(`${bans[i].userName} (id: U_${bans[i].userId})`)

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

                let changenick = DATABASE_API.updateUsername(userData[socket.id]["userID"], xss(newNick.replace(/"/g, `\\"`), config.nickFilter));

                if (changenick.code) {
                    // Error?

                    if (changenick.code == 0) {
                        return socket.emit("command_output", {
                            text: `Nickname changed failed because... you don't exist? Contact a System Administrator.`
                        });
                    } else if (changenick.code == 60) {
                        return socket.emit("command_output", {
                            text: `Nickname change failed due to Database error. Contact a System Administrator..`
                        });
                    }

                }

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
                
                let changebio = DATABASE_API.updateBio(userData[socket.id]["userID"], xss(data.bio.replace(/"/g, `\'`).replace(/'/g, `\\'`), config.xssFilter));

                if (changebio.code) {
                    // Error?

                    if (changebio.code == 0) {
                        return socket.emit("command_output", {
                            text: `Bio change failed because... you don't exist? Contact a System Administrator.`
                        });
                    } else if (changebio.code == 60) {
                        return socket.emit("command_output", {
                            text: `Bio change failed due to Database error. Contact a System Administrator..`
                        });
                    }

                }
                
                userData[socket.id]["bio"] = xss(data.bio.replace(/"/g, `\'`).replace(/'/g, `\\'`), config.xssFilter);

                socket.emit("userData_local", userData[socket.id]);
                socket.emit("command_output", {
                    text: "Bio updated."
                });
                break;

            case "room":
                console.log(`[DEBUG]: Socket ${socket.id} is moving rooms.`)
                if (moderation.mutedSockets.includes(socket.id)) return console.log(`[DEBUG]: Socket ${socket.id} is muted and can't move rooms.`);
                if (data.newRoom.substring(0,2) != "R_") return socket.emit('command_output', {text: "Invalid Room ID"});

                //if (!rooms.includes(data.newRoom)) {
                    //rooms.push(data.newRoom);

                    if (!DATABASE_API.checkRoomExists(data.newRoom)) {
                        DATABASE_API.addRoom(data.newRoom, data.newRoomName, userData[socket.id]["userID"]);
                    }
                    
                //} 
                let newr = DATABASE_API.getRoomInfo(data.newRoom);

                if (newr.roomName != data.newRoomName) {
                    return socket.emit('command_output', {text: "Access denied to room as couldn't specify room name."})
                }

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

    socket.on('disconnect', (data) => {
        console.log(`[DEBUG]: Socket ${socket.id} disconnected.`);
        if (!userData[socket.id]) return console.log(`[DEBUG]: Socket ${socket.id} had no userData.`);
        //if (moderation.godUsers.includes(socket.id)) data["userData"]["admin"] = true; else data["userData"]["admin"] = false;

        io.to(userData[socket.id].currentRoom).emit("user_update", {
            user: userData[socket.id],
            type: "leave"
        });
        //delete userData[socket.id];
        //delete moderation.godUsers[socket.id];
        //delete moderation.mutedSockets[socket.id];

        //if (messageDelay.has(socket.id)) messageDelay.delete(socket.id);
        onlineUsers--;
    });
}) 
// Tell Express to use this router when processing requests, just in case the above code throws exceptions we don't want to call it in on launch.
app.use(API_ROUTER);
app.use(USER_ROUTER);

// Start app, tell it to listen on user-defined port.
http.listen(CONFIG.ACCESS_PORT)
console.log('[DEBUG]: Listening now on HTTP');
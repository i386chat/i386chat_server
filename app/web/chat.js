"use strict";
$(() => {
    let userData = {};
    let clientData = {
        lastPM: 0,
        room: "general",
        ignored: [],
        connected: true
    }

    function arrayRemove(arr, value) {
        return arr.filter(function (ele) {
            return ele != value;
        });
    }

    function scrollToBottom() {
        $(document).scrollTop($(document).height());
    }

    function append(data) {
        $("#messages").append($(`<li>`).text(data));
        scrollToBottom();
    }

    const socket = io({
        reconnect: false
    });

    socket.on("user_connection", (data) => {
        if (clientData.connected == false) return;
        if (data.banned == true) {
            append(`You are banned for reason: ${data.reason}.`);
            socket.close();
            return;
        }
        userData = {
            nickName: prompt("What is your nickname?", "Anonymous") || "Anonymous",
            bio: "I am a i386chat user."
        };
        socket.emit("userData_init", userData);
    });

    socket.on('disconnect', (data) => {
        clientData.connected = false;
    });

    socket.on('chat_message', (data) => {
        if (clientData.ignored.includes(`${data.userData.userID}`)) return;
        let onclick_text = `onclick="append('ID: ${data.userData.userID} - ${data.userData.bio}')"`
        let extraData = ``;
        if (data.userData.admin == true) extraData += `<img src="admin-shield.svg" class="admin" />`
        $("#messages").append($(`<li><span ${onclick_text} style="color:#${data.userData.colour}">${data.userData.nickName} ${extraData}</span> >> ${data.content}</li>`));
        scrollToBottom();
    });

    socket.on('chat_private_message', (data) => {
        if (clientData.ignored.includes(`${data.userData.userID}`)) return;
        clientData.lastPM = data.userData.userID;
        let onclick_text = `onclick="append('ID: ${data.userData.userID} - ${data.userData.bio}')"`
        let extraData = ``;
        if (data.userData.admin == true) extraData += `<img src="admin-shield.svg" class="admin" />`
        $("#messages").append($(`<li><span ${onclick_text} style="color:#${data.userData.colour}">${data.userData.nickName} ${extraData} (PM)</span> >> ${data.content}</li>`));
        scrollToBottom();
    });

    socket.on('command_output', (data) => {
        append(data.text);
    });

    socket.on('user_update', (data) => {
        let extraData = ``;
        if (data.user.admin == true) extraData += `<img src="admin-shield.svg" class="admin" />`
        switch (data.type) {
            case "join":
                $("#messages").append($(`<li><span style="color:#${data.user.colour}">${data.user.nickName} ${extraData}</span> joined the chatbox.</li>`));
                break;
            case "leave":
                $("#messages").append($(`<li><span style="color:#${data.user.colour}">${data.user.nickName} ${extraData}</span> left the chatbox.</li>`));
                break;
            case "nickChange":
                $("#messages").append($(`<li><span style="color:#${data.user.colour}">${data.oldName} ${extraData}</span> is now <span style="color:#${data.user.colour}">${data.newName} ${extraData}</span>.</li>`));
                break;
            case "joinRoom":
                $("#messages").append($(`<li><span style="color:#${data.user.colour}">${data.user.nickName} ${extraData}</span> joined the room.</li>`));
                break;
            case "leaveRoom":
                $("#messages").append($(`<li><span style="color:#${data.user.colour}">${data.user.nickName} ${extraData}</span> left the room.</li>`));
                break;
            default:
                console.log("Receieved unknown user_update.");
                break;
        }

        scrollToBottom();

    });

    $('form').submit((event) => {

        event.preventDefault();
        let message = $("#m").val();

        if (message.startsWith(`//`)) {
            const args = message.slice("//").trim().split(/ +/g);
            const command = args.shift().toLowerCase();

            switch (command) {
                case "//nick":
                    if (!args[0]) return append("Usage: //nick <nickname>");
                    if (args[0].trim() == "") return append("Usage: //nick <nickname>");

                    socket.emit("userData_change", {
                        type: "nickName",
                        newNick: args.join(" ")
                    });
                    break;
                case "//bio":
                    if (!args[0]) return append("Usage: //bio <text: char max 125>");
                    if (args[0].trim() == "") return append("Usage: //bio <text: char max 125>");
                    if (args.join(" ").length > 125) return append("Usage: //bio <text: char max 125>");

                    socket.emit("userData_change", {
                        type: "bio",
                        bio: args.join(" ")
                    });
                    break;
                case "//ignore":
                    if (!args[0]) return append("Usage: //ignore <user ID>");
                    if (args[0].trim() == "") return append("Usage: //ignore <user ID>");

                    if (clientData.ignored.includes(`${args[0]}`)) {
                        clientData.ignored = arrayRemove(clientData.ignored, args[0]);
                        append(`Removed ${args[0]} from the ignore list.`);
                    } else {
                        clientData.ignored.push(`${args[0]}`);
                        append(`Added ${args[0]} to the ignore list.`);
                    }
                    break;
                case "//room":
                    if (!args[0]) return append("Usage: //room change,list,current <room name>");
                    if (args[0].trim() == "") return append("Usage: //room change,list,current <room name>");

                    switch (args[0].toLowerCase()) {
                        case "change":
                            if (!args[1]) return append("Usage: //room change <room name>");
                            if (args[1].trim() == "") return append("Usage: //room change <room name>");

                            socket.emit("userData_change", {
                                type: "room",
                                newRoom: args[1]
                            });
                            clientData["room"] = args[1];

                            break;
                        case "current":
                            append(`You are currently in ${clientData.room}.`);
                            break;
                        case "list":
                            socket.emit("user_command", {
                                command: "listAllRooms"
                            });
                            break;
                    }
                    break;
                case "//online":
                    socket.emit("user_command", {
                        command: "listOnlineUsers"
                    });
                    break;
                case "//help":
                    append(`Available commands: //online, //room, //nick, //bio, //ignore, //whisper, //reply.`);
                    break;
                case "//whisper":
                    if (!args[0] || args[0].trim() == "") return append("Usage: //whisper <user ID> <message: char max 250>");
                    if (!args[1] || args[1].trim() == "") return append("Usage: //whisper <user ID> <message: char max 250>");
                    if (args.slice(1).join(" ").length > 250) return append("Usage: //whisper <user ID> <message: char max 250>");

                    socket.emit("chat_private_message", {
                        content: args.slice(1).join(" "),
                        userData,
                        receiverID: args[0]
                    });

                    append(`Sent "${args.slice(1).join(" ")}" to user ID: ${args[0]}.`)
                    break;
                case "//god":
                    if (!args[0] || args[0].trim() == "") return append("Usage: //god <moderation code>");

                    socket.emit("godMode_enable", {
                        code: args[0]
                    });

                    break;
                case "//reply":
                    if (!args[0] || args[0].trim() == "") return append("Usage: //reply <message: char max 250>");
                    if (args.join(" ").length > 250) return append("Usage: //reply <message: char max 250>");

                    socket.emit("chat_private_message", {
                        content: args.join(" "),
                        userData,
                        receiverID: clientData.lastPM
                    });

                    append(`Replied "${args.join(" ")}" to user ID: ${clientData.lastPM}.`)
                    break;
                case "//ban":
                    if (!args[0] || args[0].trim() == "") return append("Usage: //ban <user ID> <reason>");
                    if (!args[1] || args[1].trim() == "") return append("Usage: //ban <user ID> <reason>");

                    socket.emit("user_command", {
                        command: "banUser",
                        userID: args[0],
                        reason: args.slice(1).join(" ")
                    });
                    break;
                case "//kick":
                    if (!args[0] || args[0].trim() == "") return append("Usage: //kick <user ID> <reason>");
                    if (!args[1] || args[1].trim() == "") return append("Usage: //kick <user ID> <reason>");

                    socket.emit("user_command", {
                        command: "kickUser",
                        userID: args[0],
                        reason: args.slice(1).join(" ")
                    });

                    break;
                case "//mute":
                    if (!args[0] || args[0].trim() == "") return append("Usage: //mute <user ID> <reason>");
                    if (!args[1] || args[1].trim() == "") return append("Usage: //mute <user ID> <reason>");

                    socket.emit("user_command", {
                        command: "muteUser",
                        userID: args[0],
                        reason: args.slice(1).join(" ")
                    });

                    break;
                case "//unmute":
                    if (!args[0] || args[0].trim() == "") return append("Usage: //unmute <user ID> <reason>");
                    if (!args[1] || args[1].trim() == "") return append("Usage: //unmute <user ID> <reason>");

                    socket.emit("user_command", {
                        command: "unmuteUser",
                        userID: args[0],
                    });

                    break;
            }

            $("#m").val("");
            scrollToBottom();
            return;
        }

        socket.emit("chat_message", {
            content: message,
            userData,
            room: clientData.room
        });
        $("#m").val("");
        scrollToBottom();
        return;
    });

    socket.on('userData_local', (data) => {
        userData = data;
    });
});
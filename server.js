/*
i386chat_server
2020 zer0char1sma/i386sh

I'm legitimately sorry for anyone that has to read this.
*/

// Initialising libraries
const app = require('express')();
const http = require('http').createServer(app);
const io = require('socket.io')(http);
const xss = require('xss');

app.get('/', (req, res) => {
	res.sendFile(__dirname + "/client.html");
})

// For the XSS filtering.
options = {
	whiteList: {
		strong: [],
		i: [],
		span: []
	}
}

// Constants! 
const port = 3096;
let onlineUsers = 0;
let nickNames = {};
let colours = {};
let rooms = ["general"];
let socketIDs = {}; // These are the user IDs!
let bio = {};
let IDs_to_socketIDs = {}; // socketIDs in reverse!
let rainbowUsers = [];

const recent = new Set();
const recentPM = new Set();

const getKey = (obj, val) => Object.keys(obj).find(key => obj[key] === val); // Some shit I found on stackoverflow because I needed it for a little. Not used now but kinda useful.

io.on('connection', async (socket) => {
	console.log(`DEBUG: Socket ${socket.id} connected.`);
	socket.join("general");
	socket.emit("join", onlineUsers);
	socketIDs[socket.id] = Math.floor(Math.random() * 9000000000) + 1000000000;
	IDs_to_socketIDs[socketIDs[socket.id]] = socket.id;
	socket.on('disconnect', (reason) => {
		if (!nickNames[socket.id]) return;
		onlineUsers = onlineUsers - 1;
		io.emit("user_join", {
			text: `${nickNames[socket.id]} left the chatbox.`
		});
		delete bio[socket.id];
		delete nickNames[socket.id];
		delete IDs_to_socketIDs[socketIDs[socket.id]];
		delete socketIDs[socket.id];
		console.log(`DEBUG: Socket ${socket.id} disconnected.`);
	});
	socket.on('chat_message', (messageData) => {
		console.log(`DEBUG: Socket ${socket.id} sent a chat_message packet.`)
		if (recent.has(socket.id))
			return;
		updatedData = messageData;
		updatedData["author"] = nickNames[socket.id];
		updatedData["colour"] = colours[socket.id];
		updatedData["id"] = socketIDs[socket.id];
		updatedData["bio"] = bio[socket.id];
		updatedData["text"] = xss(updatedData["text"], options);
		if (rainbowUsers.includes(socket.id)) {
			updatedData["rainbow"] = `class="rainbow"`;
		} else {
			updatedData["rainbow"] = "";
		};
		if (!nickNames[socket.id]) return;
		if (updatedData["text"].length > 250) return;
		if (nickNames[socket.id] !== messageData["author"]) return;
		recent.add(socket.id);
		room = updatedData["room"] || "general";
		io.to(room.toLowerCase()).emit("chat_message", updatedData);
		setTimeout(() => {
			recent.delete(socket.id);
		}, 250);
	});
	socket.on('room_change', (data) => {
		console.log(`DEBUG: Socket ${socket.id} sent a room_change packet.`);
		updatedData = data;
		updatedData["author"] = nickNames[socket.id];
		socket.leave(updatedData["previousRoom"]);
		if (!rooms.includes(updatedData["room"].toLowerCase())) rooms.push(updatedData["room"].toLowerCase());
		socket.join(updatedData["room"].toLowerCase());
		io.to(updatedData["room"].toLowerCase()).emit("user_join", {
			text: `${updatedData["author"]} just joined the room!`
		});
		io.to(updatedData["previousRoom"].toLowerCase()).emit("user_join", {
			text: `${updatedData["author"]} just left the room.`
		});
	});
	socket.on('bio_change', (data) => {
		console.log(`DEBUG: Socket ${socket.id} sent a bio_change packet.`);
		if (!nickNames[socket.id]) return;
		if (!socketIDs[socket.id]) return;
		bio[socket.id] = xss(data["bio"], options).replace(/'/g, "\\'").replace(/"/g, `\\'`);
		if (data["onConnect"] == false) socket.emit("command_output", `<li>Bio updated.</li>`);
	});
	socket.on("nickname_selection", (nick) => {
		console.log(`DEBUG: Socket ${socket.id} sent a nickname_selection packet.`);
		if (nickNames[socket.id]) return;
		onlineUsers = onlineUsers + 1;
		nickNames[socket.id] = xss(nick, options);
		nickNames_to_socketIDs[xss(nick, options)] = socket.id;
		colours[socket.id] = Math.floor(Math.random() * 16777216).toString(16);
		io.to("general").emit("user_join", {
			text: `${nick} just joined the chatbox!`
		});
		socket.emit("id", socketIDs[socket.id]);
	});
	socket.on("get_online_users", (x) => {
		console.log(`DEBUG: Socket ${socket.id} sent a get_online_users packet.`);
		var res = [];
		for (var i in nickNames)
			res.push(xss(nickNames[i], options));
		socket.emit("command_output", `<li>Online users: ${res.join(", ")}.</li>`);
	});
	socket.on("list_all_rooms", (x) => {
		console.log(`DEBUG: Socket ${socket.id} sent a list_all_rooms packet.`);
		socket.emit("command_output", `<li>All rooms: ${rooms.join(", ")}.</li>`);
	});
	socket.on("private_message", (messageData) => {
		console.log(`DEBUG: Socket ${socket.id} sent a private_message packet.`)
		if (recentPM.has(socket.id))
			return;
		updatedData = messageData;
		updatedData["author"] = nickNames[socket.id];
		updatedData["colour"] = colours[socket.id];
		updatedData["id"] = socketIDs[socket.id];
		updatedData["bio"] = bio[socket.id];
		updatedData["text"] = xss(updatedData["text"], options);
		if (rainbowUsers.includes(socket.id)) {
			updatedData["rainbow"] = `class="rainbow"`;
		} else {
			updatedData["rainbow"] = "";
		};
		if (!nickNames[socket.id]) return;
		if (updatedData["text"].length > 250) return;
		if (nickNames[socket.id] !== messageData["author"]) return;
		recentPM.add(socket.id);
		socket.to(IDs_to_socketIDs[updatedData["idReceiver"]]).emit("private_message", updatedData);
		setTimeout(() => {
			recentPM.delete(socket.id);
		}, 250);
	});
	socket.on('rainbow_name_code', (data) => {
		if (data == "") rainbowUsers.push(socket.id);
		else { // Haha try
			socket.emit("command_output", `<li>Nice try, Zero Charisma.</li>`);
		};
	});
})

http.listen(port, () => {
	console.log(`DEBUG: i386chat is up at port ${port}!`);
});

// No I'm not proud of this code, but it does work.
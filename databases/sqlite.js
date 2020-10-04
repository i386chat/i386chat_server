'use strict';

// Codename Char1sma Database Handler
// Funey, zer0 2020

// Load BSQL3 and open database, this could cause failure when multiple threads get going but *we'll see...*
const Database = require('better-sqlite3');
const GlobalConfig = require('../global_config')

const db = new Database('char1sma-sqlite.db'); //, { verbose: console.log });

// Initialise stuff for JSON Web Tokens.
const jwt = require('jsonwebtoken');



// Initialise DB if the database doesn't exist
module.exports.initialiseDB = function() {
    console.log(`[DEBUG]: Database doesn't exist/is corrupted. Re-initialising...`)
    let CreateBOTS = `CREATE TABLE "BOTS" (
        "botId"	TEXT,
        "botName"	TEXT,
        "botBio"	TEXT,
        "banned"	INTEGER,
        PRIMARY KEY("botId")
    );`

    let CreateUSERS = `CREATE TABLE "USERS" (
        "userId"	TEXT,
        "userName"	TEXT,
        "userBio"	TEXT,
        "privilegeLevel"	INTEGER,
        "banned"	INTEGER,
        PRIMARY KEY("userId")
    );`

    let CreateROOMS = `CREATE TABLE "ROOMS" (
        "roomId"	TEXT,
        "roomName"	TEXT,
        "roomBio"	TEXT,
        "creatorUserId"	TEXT,
        "visibility"	INTEGER,
        FOREIGN KEY("creatorUserId") REFERENCES "USERS"("userId") ON DELETE SET null,
        PRIMARY KEY("roomId")
    );`

    let InitUSERS = 'INSERT INTO USERS (userId, userName, userBio, privilegeLevel, banned) VALUES (?, ?, ?, ?, ?)'
    let InitROOMS = 'INSERT INTO ROOMS (roomId, roomName, roomBio, creatorUserId, visibility) VALUES (?, ?, ?, ?, ?)'

    try {
        // Create requesite tables.

        db.exec(CreateUSERS);
        db.exec(CreateBOTS);
        db.exec(CreateROOMS);

        // Add system user.
        db.prepare(InitUSERS).run("1", "SYSTEM", "I am the system!", 255, 0);
        // Create general chat room.
        db.prepare(InitUSERS).run("9999", "general", "General channel for the entirety of the server.", "9999", 1);    
    } catch (err){
        throw err;
    }
}

//try {
    let row = db.prepare('SELECT * FROM USERS WHERE USERS.userId = ?').get(9999);
    if (typeof row != "undefined") module.exports.initialiseDB();
//} catch {
    //module.exports.initialiseDB();
//}

// Generate user ID/bot ID.
module.exports.generateId = function(type) {
    let bRunning = true;
    let userId = type + "_000000000000"
    while (bRunning) {
        userId = type + "_" + Math.floor(Math.random() * 999999999999) + 1  

        switch (type) {
            case "U": // User
                if ( !module.exports.checkUserExists(userId) ) {
                    // User doesn't exist. We can exit loop.
                    bRunning = false;
                }
                break;
            case "B": // Bot
                if ( !module.exports.checkBotExists(userId) ) {
                    // User doesn't exist. We can exit loop.
                    bRunning = false;
                }
                break;
        }

    }

    // Return generated ID to user.
    return userId;
}

// Check if user exists, return true if yes or false if not.
module.exports.checkUserExists = function(UserID) {
    let row = db.prepare('SELECT * FROM USERS WHERE USERS.userId = ?').get(UserID.substring(2));
    if (typeof row != "undefined") return true; else return false;
}

module.exports.checkBotExists = function(UserID) {
    let row = db.prepare('SELECT * FROM BOTS WHERE BOTS.botId = ?').get(UserID.substring(2));
    if (typeof row != "undefined") return true; else return false;
}


module.exports.checkRoomExists = function(roomId) {
    let row = db.prepare('SELECT * FROM ROOMS WHERE ROOMS.roomId = ?').get(roomId.substring(2));
    if (typeof row != "undefined") return true; else return false;
}

module.exports.getRoomInfo = function(RoomId) {
    try {
        return db.prepare('SELECT * FROM ROOMS WHERE ROOMS.roomId = ?').get(RoomId.substring(2));
    } catch {
        console.log(err);
        return false;
    }
}

module.exports.isUserGod = function(userId) {
    if (!module.exports.checkUserExists(userId)) {
        // User doesn't exist?
        return {code: 0, error: "Token is invalid / user doesn't exist."};
    }

    let user = module.exports.getUserInfo(userId);

    if ( user.privilegeLevel == 255 ) return true; else return false;
}

module.exports.banUser = function(userId) {

    if (!this.checkUserExists(userId)) return {code: 0, error: "Token is invalid / user doesn't exist."};

    try {
        const info = db.prepare('UPDATE USERS SET banned = 1 WHERE userId = ?').run(userId.substring(2));

        return true;
    } catch (err) {
        return {code: 60, error: "Ban failed due to SQLite error."}
    }

}

module.exports.updateUsername = function(userId, newNickname) {

    if (!this.checkUserExists(userId)) return {code: 0, error: "Token is invalid / user doesn't exist."};

    try {
        const info = db.prepare('UPDATE USERS SET userName = ? WHERE userId = ?').run(newNickname, userId.substring(2));

        return true;
    } catch (err) {
        return {code: 60, error: "Ban failed due to SQLite error."}
    }

}

module.exports.updateBio = function(userId, newBio) {

    if (!this.checkUserExists(userId)) return {code: 0, error: "Token is invalid / user doesn't exist."};

    try {
        const info = db.prepare('UPDATE USERS SET userBio = ? WHERE userId = ?').run(newBio, userId.substring(2));

        return true;
    } catch (err) {
        return {code: 60, error: "Ban failed due to SQLite error."}
    }

}

module.exports.unbanUser = function(userId) {

    if (!this.checkUserExists(userId)) return {code: 0, error: "Token is invalid / user doesn't exist."};

    try {
        const info = db.prepare('UPDATE USERS SET banned = 0 WHERE userId = ?').run(userId.substring(2));

        return true;
    } catch (err) {
        return {code: 60, error: "Ban failed due to SQLite error."}
    }

}

module.exports.getAllBanned = function() {
    let row = db.prepare('SELECT * FROM USERS WHERE USERS.banned = 1').all();
    return row;
}

module.exports.getAllRooms = function() {
    let row = db.prepare('SELECT * FROM ROOMS').all();
    return row;
}


module.exports.getUserInfo = function(UserId) {
    try {
        let u_info = db.prepare('SELECT * FROM USERS WHERE USERS.userId = ?').get(UserId.substring(2));
        
        if (u_info.banned == 1) {
            // User is banned...
            return {code: 99, error: 'User is banned from this chat server.'};
        } else {
            return u_info;
        }
    } catch (err) {
        console.log(err);
        return false;
    }
}

module.exports.getBotInfo = function(UserId) {
    try {
        let u_info = db.prepare('SELECT * FROM BOTS WHERE BOTS.botId = ?').get(UserId.substring(2));
        
        if (u_info.banned == 1) {
            // User is banned...
            return {code: 99, error: 'Bot is banned from this chat server.'};
        } else {
            return u_info;
        }
    } catch (err) {
        console.log(err);
        return false;
    }
}

module.exports.addRoom = function(RoomId, RoomName, CreatorID) {
    // Create a room.


    try {
        let stmt = db.prepare('INSERT INTO ROOMS (roomId, roomName, roomBio, creatorUserId, visibility) VALUES (?, ?, ?, ?, ?)');
        let out = stmt.run(RoomId.substring(2), RoomName, "IMPLEMENT", CreatorID.substring(2), 1);

    } catch (err) {
        console.log(err)
        return false;
    }

}

module.exports.createUser = function(UserName, Bio) {
    // Create a user.

    UserName = UserName || "Anonymous";
    Bio = Bio || "I forgot to enter my bio!";

    try {
        let UID = module.exports.generateId("U")
        let stmt = db.prepare('INSERT INTO USERS (userId, userName, userBio, privilegeLevel, banned) VALUES (?, ?, ?, ?, ?)');
        let out = stmt.run(UID.substring(2), UserName, Bio, 1, 0);

        
        return jwt.sign({userId: UID, type: 'user'}, GlobalConfig.JWT_SECRET);
    } catch (err) {
        console.log(err)
        return false;
    }

}

module.exports.getRoomList = function() {
    try {
        let row = db.prepare('SELECT roomName, roomBio FROM ROOMS WHERE visibility = 1;').all();
        return row
    } catch (err) {
        console.log(err);
        return false;
    }
}

//console.log(module.exports.createUser('Funey', "I'm an i386 chat user!"))
console.log('[DEBUG]: SQLite DB loaded.')
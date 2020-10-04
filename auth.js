'use strict';

// Codename Char1sma Authentication Script
// Funey, zer0 2020

const GLOBAL_CFG = require('./global_config')
const DATABASE_API = require('./databases/' + GLOBAL_CFG.DB_TYPE)

const jwt = require('jsonwebtoken')

module.exports.authenticateUser = function (token) {
    let authed = false;

   
    jwt.verify(token, GLOBAL_CFG.JWT_SECRET, function(err, decoded) {
        if (err) return false;
        // TODO: Authentication Script, hooking into DB API.
        // TODO: Check user validity before sending them to their endpoint.
        if (DATABASE_API.checkUserExists(decoded.userId)) {
            authed = decoded
        } else {
            // What the fuck?
            // What did the- how did they get our private key?
            // In fact, we'd check if a BOT with that ID exists.
            authed = false
        }
        
    });

    return authed
}

module.exports.authenticateBot = function (token) {
    let authed = false;

   
    jwt.verify(token, GLOBAL_CFG.JWT_SECRET, function(err, decoded) {
        if (err) return false;
        // TODO: Authentication Script, hooking into DB API.
        // TODO: Check user validity before sending them to their endpoint.
        if (DATABASE_API.checkBotExists(decoded.userId)) {
            authed = decoded
        } else {
            // What the fuck?
            // What did the- how did they get our private key?
            // In fact, we'd check if a BOT with that ID exists.
            authed = false
        }
        
    });

    return authed
}
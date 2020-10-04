'use strict';

const CONFIG = require('./global_config');
const DATABASE_API = require('./databases/' + CONFIG.DB_TYPE);



module.exports = {
    "test": {
        requestType: "GET",
        authenticationRequired: false,
        requestFunction: function(req, res) {
            res.send("Test");
        }
    },
    "create-account": {
        requestType: "POST",
        authenticationRequired: false, // Cause they don't have an account!
        requestFunction: function(req, res) {
            
        }
    },
    "create-account": {
        requestType: "POST",
        authenticationRequired: false, // Cause they don't have an account!
        requestFunction: function(req, res) {
            
        }
    }
}
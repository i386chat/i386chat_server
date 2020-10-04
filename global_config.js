'use strict';

module.exports = {
    API_VERSION: 1, // Denotes where the API endpoint should be accessed from.
    ACCESS_PORT: 80, // Port number for networking. Some Linux OSes only allow binding of certain ports by root (for obvious reasons.)
    API_LOCATION: "/api/v1/", // Location that the API should reside.
    DB_TYPE: "sqlite", // Default is sqlite, might bundle support for Redis/Cassandra in future. NOTHING ELSE WILL WORK.
    JWT_SECRET: "sgjoer8gu43oughn345908g3h90ou834hjg9o34ugh34908ghy349g" // Make this random garble!!! Otherwise people can decode your JWTs and spoof users.
}
// We'd like to authenticate users, the easiest way to track authentication is the session
const session = require("express-session");
// Using Express as our server
const express = require("express");
// Using fetch for communication with Miro.com API
const fetch = require("node-fetch");
// Handling HTTP requests
const http = require("http");
// Real time communication between user boards is done via WebSockets
const WebSocket = require("ws");
// We need to uniquely identify the users server-side
const uuid = require("uuid");
// Simplifying the handling of CORS
const cors = require("cors");

const userClientMap = new Map();

// Init the app
const app = express();

// Handling static files
app.use(express.static("public"));

// We'll allow requests from the same origin and sending the credentials (e.g. cookies)
app.use(cors({
    origin: true,
    credentials: true
}));

// Parse the session using server side secret
const sessionParser = session({
    saveUninitialized: false,
    secret: 'realsecret_yes',
    resave: false
});

app.use(sessionParser);

app.use(express.json());

const API_BASE = 'https://api.miro.com/v1';

/*
 * Authentication endpoint
 */
app.post("/auth", function(request, response) {

    // Access token for user
    const accessToken = request.headers['x-token'];
    // Board ID supplied by user
    const boardId = request.headers['x-board-id'];

    // Get the user-board connection
    fetch(`${API_BASE}/board-user-connections/${boardId}?&access_token=${accessToken}`)
        .then(response => {
            return response.json();
        })
        .then(json => {
            if (json.role == "owner" || json.role == "editor") {
                return true;
            }
        })
        .then(() => {
            // Create server-side user ID
            const id = uuid.v4();

            // Store server-side user ID to session
            request.session.userId = id;

            // Store Board ID to session
            request.session.boardId = boardId;

            // And notify user about success
            response.send({ result: 'OK', message: 'Session updated'});
        });
});

/*
 * Thin API forwarder that handles user-team connections
 * We'll get the User's access token (obtained in the frontend plugin via implicit OAuth)
 */
app.get("/team", function(request, response) {

    const accountId = request.headers['x-account'];
    const accessToken = request.headers['x-token'];

    fetch(`${API_BASE}/teams/${accountId}/user-connections?fields=user{id,name,picture}&limit=100&access_token=${accessToken}`)
        .then(response => {
            return response.json();
        })
        .then(json => {
            response.send(json.data);
        })
});

/*
 * WebSocket server creation
 */

// We'd like to use already created Express server...
const server = http.createServer(app);

// ...and start our WebSocket server with:
// - client tracking (so we can broadcast messages)
// - noServer parameter - to use previously built Express server
const wss = new WebSocket.Server({
    clientTracking: true,
    noServer: true
});

// We need to check if user has been previously authenticated with our server
// during the HTTPS -> WSS upgrade
server.on('upgrade', function(request, socket, head) {

    // Is the user authenticated?
    sessionParser(request, {}, () => {

        // No, we'll close connection immediately
        if (!request.session.userId) {
            socket.destroy();
            return;
        }

        // User is authenticated, we can upgrade to WSS connection
        wss.handleUpgrade(request, socket, head, function(ws) {
            wss.emit('connection', ws, request);
        });
    });
});

// Opening the client-server connection.
// User has been previously authenticated (during upgrade), we'll get the ID
wss.on('connection', function(ws, request) {

    const userId = request.session.userId;
    const boardId = request.session.boardId;

    userClientMap.set(userId, {
        boardId: boardId,
        client: ws
    });

    // When message from client is received, we'd like to broadcast it to other Users
    // on the same board
    ws.on('message', function(message) {

        userClientMap.forEach((clientInfo, storedUserId) => {

            // Notify:
            // - everybody listening for events on the same board
            // - that has WebSocket open
            // - and is not the one that sent the message
            if (clientInfo.boardId == boardId && clientInfo.client.readyState === WebSocket.OPEN && userId != storedUserId) {
                clientInfo.client.send(message);
            }
        });
    });

    // Do not notify user anymore, after the connection has been closed
    ws.on('close', function() {
        userClientMap.delete(userId);
    });
});


// And of we go!
const listener = server.listen(process.env.PORT, function() {
    console.log("Your app is listening on port " + listener.address().port);
});

let socket;
let socketOpenListener;

async function authenticateAndOpenWebsocketConnection() {
    return fetch(Config.auth_api, {
        headers: {
            'X-Token': await miro.getToken(),
            'X-Board-Id': (await miro.board.info.get()).id
        },
        method: "POST",
        credentials: "include",
    })
        .then(response => response.json())
        .then(json => {
            if (json.result == "OK") {
                openSocket();
                return true;
            }
        });
}

function openSocket() {
    // Create new socket
    socket = new WebSocket(Config.websocket);

    // We can (and do) have an external open listener
    // e.g. broadcast forwarder
    socket.onopen = function() {
        if (socketOpenListener !== undefined) {
            socketOpenListener();
        }
    }

    socket.onclose = function(){
        // Try to reconnect in 5 seconds
        setTimeout(() => {
            authenticateAndOpenWebsocketConnection()
        }, 5000);
    };
}

async function sendMessageToWebsocket (message) {
    if (socket.readyState === WebSocket.OPEN) {
        socket.send(message);
    }
}
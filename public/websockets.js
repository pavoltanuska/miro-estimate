let socket;

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
                socket = new WebSocket(Config.websocket);
                return true;
            }
        });
}

async function sendMessageToWebsocket (message) {
    if (socket.readyState === WebSocket.OPEN) {
        socket.send(message);
    }
}
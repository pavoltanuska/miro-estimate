// init project
const express = require("express");
const app = express();
const fetch = require("node-fetch");

app.use(express.static("public"));

const corsHeaders = {
    'Access-Control-Allow-Origin': 'https://bytscrape.api1.sk',
    'Access-Control-Allow-Headers': 'X-Account, X-Token'
};

app.get("/team", function(request, response) {

    let requestHeaders = request.headers;

    fetch(`https://api.miro.com/v1/teams/${requestHeaders['x-account']}/user-connections?fields=user{id,name,picture}&limit=100&access_token=${requestHeaders['x-token']}`)
        .then(response => {
            return response.json();
        }).then(json => {
        response.set(corsHeaders).send(json.data);
    })

});

app.options("/team", function(request, response) {
    response.set(corsHeaders).send();

});

// listen for requests :)
const listener = app.listen(process.env.PORT, function() {
    console.log("Your app is listening on port " + listener.address().port);
});

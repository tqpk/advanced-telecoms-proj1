const WebSocket = require('ws');

const ws = new WebSocket('http://127.0.0.1:3000');

ws.on('open', function open() {
  console.log("Opened a WebSocket connection to the proxy server @ http://localhost:3000!");
});

ws.on('message', function message(message) {
    console.log('Response from proxy: %s', message);
});

var stdin = process.openStdin();

stdin.addListener("data", function(data) {

  var input = data.toString();
  var command = input.substring(0, input.indexOf(' '));

  if(command.toLowerCase() == "request") {

    ws.send(input.substring(8).trim());
    
  }
  else {

    console.log("Invalid command!");

  }

});

const 
http = require('http'), 
https = require('https'), 
WebSocket = require('ws'), 
url = require('url'),
fs = require('fs'),
NodeCache = require( "node-cache" );

var startTime = 0;
var endTime = 0;

// Set parameters for the cache, stdTTL is the timeout in seconds of keys after which they expire
// checkperiod is the frequency of checks for expired keys
const myCache = new NodeCache({ stdTTL: 3600, checkperiod: 60 });

// Set hostname and port
const hostname = '127.0.0.1';
const port = 3000;

// Loads array of blocked urls using locally stored text file
var blockedURLs = fs.readFileSync('blockedURLs.txt').toString();

// Set up input handling for management console
var stdin = process.openStdin();

stdin.addListener("data", function(data) {

  // Separate command and argument
  var input = data.toString();
  var command = input.substring(0, input.indexOf(' '));
  var arg = input.substring(input.indexOf(' ') + 1);
  
  if(command.toLowerCase() == "block") {
    
    blockURL(arg);

  }
  else if (command.toLowerCase() == "unblock") {

    unblockURL(arg);

  }
  else {

    console.log("Command not recognised!");

  }

});

// Function to add a url to the list of blocked urls
function blockURL(url) {

  if(!blockedURLs.includes(url)) {

    // Add url to the list of URLs to block
    fs.appendFileSync('blockedURLs.txt', url);

    // Update string of blocked urls
    blockedURLs = fs.readFileSync('blockedURLs.txt').toString();

  }
  else {

    console.log("This URL is already blocked!");

  }

}

// Function to remove a url from the list of blocked urls
function unblockURL(url) {

  if(blockedURLs.includes(url)) {

    blockedURLs = blockedURLs.replace(url, '');

    fs.writeFileSync('blockedURLs.txt', blockedURLs);

  }
  else {

    console.log("This URL is not blocked!");

  }

}

// Used for dealing with requests where the host is is improperly specified
// When a file references locally stored assets, a http request is made but
// doesn't specify a host, this will allow me to store the host and therefore
// add it back into the request url
var initialProtocolAndHost = '';

// Creates a web server
var server = http.createServer(handleRequest).listen(port, function () {

  console.log('Proxy server is listening on port 3000! Go to http://localhost:3000/');

})

// Handles requests received by the web server
function handleRequest(req, res) {

  var receivedURLInfo = url.parse(req.url.substring(1, req.url.length));

  if(receivedURLInfo.hostname != null && receivedURLInfo.hostname.includes(".")) {

    initialProtocolAndHost = receivedURLInfo.protocol + "//" + receivedURLInfo.hostname;
    
  }
  else {

    var temp = receivedURLInfo.href.substring(receivedURLInfo.href.indexOf(receivedURLInfo.hostname));
    receivedURLInfo.host = initialProtocolAndHost.substring(initialProtocolAndHost.indexOf("//") + 2);
    receivedURLInfo.href = initialProtocolAndHost + "/" + temp;

  }

  console.log("Proxy has received request for: %s", receivedURLInfo.href);

  if(!blockedURLs.includes(receivedURLInfo.host)) {

    startTime = new Date().getTime();

    var cachedData = myCache.get(receivedURLInfo.href);

    if(cachedData != undefined) {

      console.log("Request found in cache. Cached data has been sent.");
      res.write(cachedData);
      res.end();
      endTime = new Date().getTime();
      console.log("Request completed in " + (endTime - startTime) + "ms.");

    }
    else {

      if(receivedURLInfo.protocol == "http:") {

        console.log("Request not found in cache. Sending HTTP request.");
      
        http.get(receivedURLInfo.href, (proxyRequest) => {
      
          var proxyResponse = '';
      
          proxyRequest.on('data', (data) => { proxyResponse += data; });
          proxyRequest.on('end', () => {  myCache.set(receivedURLInfo.href, proxyResponse); res.write(proxyResponse); res.end(); endTime = new Date().getTime(); console.log("Request completed in " + (endTime - startTime) + "ms."); });
            
        });
          
      }
      else if(receivedURLInfo.protocol == "https:") {

        console.log("Request not found in cache. Sending HTTPS request.");
          
        https.get(receivedURLInfo.href, (proxyRequest) => {
      
        var proxyResponse = '';
      
        proxyRequest.on('data', (data) => { proxyResponse += data; });
        proxyRequest.on('end', () => { myCache.set(receivedURLInfo.href, proxyResponse); res.write(proxyResponse); res.end(); endTime = new Date().getTime(); console.log("Request completed in " + (endTime - startTime) + "ms."); });
            
        });
    
      }

    }

  } 
  else {

    console.log("This URL is blocked!");
    res.write("This URL is blocked!");
    res.end();

  }

}

// Creates a WebSocket server
const webSocketServer = new WebSocket.Server({server});

// When a WebSocket connection is received, do the following:
webSocketServer.on('connection', function connection(ws, req) {

  console.log("Received a WebSocket connection from: %s:%s", req.socket.remoteAddress, req.socket.remotePort);

  ws.on('message', function incoming(req) {
    handleWebSocketRequest(req, ws);
  });
  
});

// When a websocket request is received, do the following:
function handleWebSocketRequest(req, ws) {

  var receivedURLInfo = url.parse(req);

  if(receivedURLInfo.hostname != null && receivedURLInfo.hostname.includes(".")) {
    initialProtocolAndHost = receivedURLInfo.protocol + "//" + receivedURLInfo.hostname;
  }
  else {
    var temp = receivedURLInfo.href.substring(receivedURLInfo.href.indexOf(receivedURLInfo.hostname));
    receivedURLInfo.host = initialProtocolAndHost.substring(initialProtocolAndHost.indexOf("//") + 2);
    receivedURLInfo.href = initialProtocolAndHost + "/" + temp;
  }

  console.log("Proxy has received WebSocket request for: %s", receivedURLInfo.href);

  if(!blockedURLs.includes(receivedURLInfo.host)) {

    startTime = new Date().getTime();

    var cachedData = myCache.get(receivedURLInfo.href);

    if(cachedData != undefined) {

      console.log("Request found in cache. Cached data has been sent.");
      ws.send(cachedData);
      endTime = new Date().getTime();
      console.log("Request completed in " + (endTime - startTime) + "ms.");

    }
    else {

      if(receivedURLInfo.protocol == "http:") {
    
        http.get(receivedURLInfo.href, (proxyRequest) => {
      
          var proxyResponse = '';
      
          proxyRequest.on('data', (data) => { proxyResponse += data; });
          proxyRequest.on('end', () => { myCache.set(receivedURLInfo.href, proxyResponse); ws.send(proxyResponse); endTime = new Date().getTime(); console.log("Request completed in " + (endTime - startTime) + "ms."); });
            
        });
          
      }
      else if(receivedURLInfo.protocol == "https:") {
          
          https.get(receivedURLInfo.href, (proxyRequest) => {
      
          var proxyResponse = '';
      
          proxyRequest.on('data', (data) => { proxyResponse += data; });
          proxyRequest.on('end', () => { myCache.set(receivedURLInfo.href, proxyResponse); ws.send(proxyResponse); endTime = new Date().getTime(); console.log("Request completed in " + (endTime - startTime) + "ms."); });
            
        });
    
      }

    }

  }
  else {

    console.log("This URL is blocked!");
    ws.send("This URL is blocked!");

  }

}




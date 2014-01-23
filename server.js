var express = require('express');               // For something I can't remember
var request = require('request');               // For video validation    
var app = express();                            // For routes
var http = require('http');
var server = http.createServer(app);
var io = require('socket.io').listen(server);
var fs = require('fs');                         // For file I/O
var crypto = require("crypto");                 // For tripcode generation
var serverPort = 80;                            // Default port

console.log("Listening on port " + serverPort);
server.listen(serverPort);
io.set('log level', 1); // Log warnings and errors only

// PLAYLIST API
//http://gdata.youtube.com/feeds/api/playlists/[ID without PL]/?v=2&alt=json
//Ex: 51A29C846A005F0A

// Routing - Don't know wtf I'm doing here -- fix this
app.get('/', function (req, res) {
  res.sendfile(__dirname + '/index.html');
});

app.get('/main.js', function (req, res) {
  res.sendfile(__dirname + '/main.js');
});

app.get('/styles/default/default.css', function (req, res) {
  res.sendfile(__dirname + '/styles/default/default.css');
});

app.get('/styles/default/border.png', function (req, res) {
  res.sendfile(__dirname + '/styles/default/border.png');
});

app.get('/styles/default/bkg.jpg', function (req, res) {
  res.sendfile(__dirname + '/styles/default/bkg.jpg');
});

// Constants
var CHATLOG_MAX_SIZE    = 40;
var MAX_USERS           = 100;
var MAX_VIDEOS          = 200;
var SPAM_CHECK_TIME     = 1000;  // In milliseconds
var SPAM_CHAT_THRESH    = 4;     // >4 msgs/sec is considered spamming (to me, at least)
var SPAM_MSG_THRESH     = 20;    // Client should never have to send more than 20 msgs/sec
var MSG_MAX_SIZE        = 10000; // 10KB max message size
var CHAT_MSG_MAX_SIZE   = 200;   // 200 max chars per chat message
var COOLDOWN_CHAT_EMBED = 10;    // Seconds
var COOLDOWN_SHUFFLE    = 30;
var COMMAND_TIMEOUT     = 3000;

// Enums
var USER_TYPE =
{
    "admin":    0,
    "mod":      1,
    "normal":   2
}

var PLAYER_STATE_TYPE =
{
    "finished": 0,
    "playing":  1,
    "paused":   2
}

// Server currently only suports one room. Should be able to encapsulate
// this into a JavaScript object. Maybe.


//========BASIC DATA STORAGE===========//
// user {string name, string id, string ip, date lastspammingCheck, int msgCount, int chatMsgCount, date lastChatEmbed, USER_TYPE userType, bool skipped, string votedVideo}
var userList        = [];    

// user {string name, USER_TYPE userType, string imgBase64}
var userInfo        = [];    

// video {string id, string title, string duration, string addedBy, string source}
var videoList       = [];

// users with finished video [string name]
var finishedUsers   = [];    

// users who would like to skip the current video [string id]
var skipList        = [];

// keep track of votes on a video -- "video id": votes  
var videoVotes		= {};

// item {string username, string text, string timestamp}
var chatLog         = [];

// ip list {ip: user.ip, lastName: user.username, banDate: now, expiration: length (int days), reason: reason}
var banList         = [{ip: '1234', lastName: 'someone', banDate: '', expiration: '', reason: 'idgaf'}];

// list of tripcodes
var adminList       = ["Gunbard!eGTll4"];

// list of tripcodes
var modList         = ["Imaweiner!asdf", "asdfsdf!what", "lel!RqCi8E"];

// PRIVS
// User: standard user, can add to unlocked playlist
// MasterUser: can manipulate playlist, video
// Mod: take master from user, boot
// Admin: ban, take master from mod, mod/de-mod
                   
var userCount           = 0;
var masterUser          = "";
var masterUserId        = "";
var guestMasterUser     = "";       // Guest master only provides sync-related info
var masterTime          = 0;
var currentVideo        = "";       // Id of video
var streamSource        = "";
var videoIsStream       = false;
var masterless          = false;    // aka TV mode
var paused              = false;
var validatedVideos     = 0;
var skipUsePercent      = false;
var skipsNeeded         = 1;        // Set to 0 to ignore skips   
var skipPercent         = 66;
var skippingEnabled     = true;
var playlistLocked      = false;
var videoVotingEnabled  = true;
var giveMasterToUser    = true;     // Allow any user to be master
var videoVoteMode       = true;     // Votes affect what video plays next
var videoByVoteThresh   = 2;        // Mininum number of votes needed
var commandTimer;

// Reload settings if found
fs.exists('savedSettings.txt', function (exists) 
{
    if (exists)
    {
        fs.readFile('savedSettings.txt', 'utf-8', function (err, data) 
        {
            if (err)
            {
                console.log(err);
            }
            else if (data.length > 0)
            {
                var oldData = JSON.parse(data);
                if (oldData.length > 0)
                {
                    skipUsePercent = oldData.skipUsePercent;
                    skipsNeeded = oldData.skipsNeeded;
                    skipPercent = oldData.skipPercent;
                    skippingEnabled = oldData.skippingEnabled;
                    playlistLocked = oldData.playlistLocked;
                    videoVotingEnabled = oldData.videoVotingEnabled;
                    giveMasterToUser = oldData.giveMasterToUser;
                    videoVoteMode = oldData.videoVoteMode;
                    videoByVoteThresh = oldData.videoByVoteThresh;
                }
            }
        });
        console.log("Saved settings found and loaded");
    }
});

// Reload modList if found
fs.exists('savedModList.txt', function (exists) 
{
    if (exists)
    {
        fs.readFile('savedModList.txt', 'utf-8', function (err, data) 
        {
            if (err)
            {
                console.log(err);
            }
            else if (data.length > 0)
            {
                var oldData = JSON.parse(data);
                if (oldData.length > 0)
                {
                    modList = oldData;
                }
            }
        });
        console.log("Saved modList found and loaded");
    }
});

// Reload banList if found
fs.exists('savedBanList.txt', function (exists) 
{
    if (exists)
    {
        fs.readFile('savedBanList.txt', 'utf-8', function (err, data) 
        {
            if (err)
            {
                console.log(err);
            }
            else if (data.length > 0)
            {
                var oldData = JSON.parse(data);
                if (oldData.length > 0)
                {
                    banList = oldData;
                }
            }
        });
        console.log("Saved banList found and loaded");
    }
});

// Reload playlist if found
fs.exists('savedPlaylist.txt', function (exists) 
{
    if (exists)
    {
        fs.readFile('savedPlaylist.txt', 'utf-8', function (err, data) 
        {
            if (err)
            {
                console.log(err);
            }
            else if (data.length > 0)
            {
                var oldPlaylist = JSON.parse(data);
                if (oldPlaylist.length > 0)
                {
                    videoList = oldPlaylist;
                    currentVideo = videoList[0].id;
                }
            }
        });
        console.log("Saved playlist found and loaded");
    }
});


// Formats a date string. Expects a UTC date and will convert to local automatically.
function timestamp(date)
{
    date           += " UTC";
    var dateObj 	= new Date(date);
    var day 		= dateObj.getDate();
    var month 		= dateObj.getMonth() + 1;
    var year 		= dateObj.getFullYear();
    var hours		= dateObj.getHours();
    var minutes		= dateObj.getMinutes();
    var seconds		= dateObj.getSeconds();
    var suffix		= "AM";
    
    if (minutes < 10)
    {
        minutes = "0" + minutes;
    }
    
    if (seconds < 10)
    {
        seconds = "0" + seconds;
    }
    
    if (hours >= 12)
    {
        suffix = "PM";
        hours = hours - 12;
    }
    
    if (hours == 0)
    {
        hours = 12;
    }
    
    var str = hours + ":" + minutes + ":" + seconds + " " + suffix;
    
    return str;
}

// Escape html tags
function htmlEscape(str) 
{
    return str.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

// Generates a unique tripcode from a string
function generateTrip(str)
{
    var MD5 = crypto.createHash("MD5");
    MD5.update(str);
    var trip = MD5.digest("base64").slice(0, 6);
    console.log("Generated trip " + trip);
    return trip;
}

io.sockets.on('connection', function (socket) 
{
    var userId = socket.id;
    var username = socket.username;
    var ip = socket.handshake.address.address;

    /****SERVER FUNCTIONS*******************/
    
    // Validate a float
    function isFloat(n) 
    {
        return n===+n && n!==(n|0);
    }
    
    // Delete a user from the userList and userInfo
    function removeUser(name)
    {
        for (var i = 0; i < userList.length; i++)
        {
            if (userList[i].name == name)
            {
                userList.splice(i, 1);
                break;
                //console.log("User " + name + " removed from list");
            }
        }
        
        // Remove from userInfo, too
        for (var i = 0; i < userInfo.length; i++)
        {
            if (userInfo[i].name == name)
            {
                userInfo.splice(i, 1);
                break;
            }
        }
    }
    
    // Verify who I'm talking to is the same guy who first walked in
    function validUser()
    {
        // Id must match name
        for (var i = 0; i < userList.length; i++)
        {
            if (userList[i].name == socket.username)
            {
                if (userList[i].id == socket.id)
                {
                    return true;
                }
                else
                {
                    return false;
                }
            }
        }
    }
    
    // Verify who I'm talking to is an administrator
    function isAdmin()
    {
        return (adminList.indexOf(socket.username) > -1);
    }
    
    // Verify who I'm talking to is a moderator
    function isMod()
    {
        return (modList.indexOf(socket.username) > -1);
    }
    
    // Verify who I'm talking to is the master user or an admin
    function isMasterUser()
    {
        return (masterUser == username && masterUserId == userId);
    }
    
    
    // Update everyone's list of users
    function syncUserList()
    {
        io.sockets.emit('userListSync', userInfo);
    }
    
    // Update everyone's list of videos
    function syncVideoList()
    {   
        io.sockets.emit('videoListSync', videoList);
    }
    
    // Go to next video in playlist
    function nextVideo()
    {
        var videoIdx = indexById(currentVideo);
            
        // Override for skipping streams
        if (videoIdx < 0 && videoList.length > 0)
        {
            videoIdx = 0;
        }
        
        if (videoIdx > -1)
        {
            var nextVideo;
            if (videoIdx >= videoList.length - 1)
            {
                nextVideo = videoList[0].id;
            }
            else
            {
                nextVideo = videoList[videoIdx + 1].id;
            }

            if (nextVideo)
            {
                videoIsStream = false;
                currentVideo = nextVideo;
                sendVideoChange(currentVideo);
                sendCurrentVideo();
                // Reset skips
                skipList = [];
            }
        }
    }
    
    // Go to video with highest votes 
    function nextVideoByVotes()
    {   
        var votes = [];
        Object.keys(videoVotes).forEach(function (key) 
        { 
            var value = videoVotes[key];
            votes.push([key, value]);
        });
        
        // Find highest voted video
        var highestVoted = ["", 0];
        for (var i = 0; i < votes.length; i++)
        {
            if (votes[i])
            {
                if (votes[i][1] > highestVoted[1] && votes[i][1] >= videoByVoteThresh)
                {
                    highestVoted = votes[i];
                }
            }
        }
        
        if (videoVotes.length == 0 || highestVoted[0].length == 0)
        {
            nextVideo();
            return;
        }
        
        var highestVotedId = highestVoted[0];
        sendVideoChange(highestVotedId);
    }
    
    function savePlaylist()
    {
        // Save to file just in case server dies
        fs.writeFile("savedPlaylist.txt", JSON.stringify(videoList), function (err) 
        {
            if (err) 
            {
                console.log(err);
            }
        });
    }
    
    function saveSettings()
    {
        var settings = 
        {
            "skipUsePercent": skipUsePercent,
            "skipsNeeded": skipsNeeded,
            "skipPercent": skipPercent,
            "skippingEnabled": skippingEnabled,
            "playlistLocked": playlistLocked,
            "videoVotingEnabled": videoVotingEnabled,
            "giveMasterToUser": giveMasterToUser,
            "videoVoteMode": videoVoteMode,
            "videoByVoteThresh": videoByVoteThresh
        };
        
        fs.writeFile("savedSettings.txt", JSON.stringify(settings), function (err) 
        {
            if (err) 
            {
                console.log(err);
            }
        });
    }
    
    function saveModList()
    {
    	fs.writeFile("savedModList.txt", JSON.stringify(modList), function (err) 
        {
            if (err) 
            {
                console.log(err);
            }
        });
    }
    
    function saveBanList()
    {
        fs.writeFile("savedBanList.txt", JSON.stringify(banList), function (err) 
        {
            if (err) 
            {
                console.log(err);
            }
        });
    }
    
    // Delete by index
    function syncDeleteVideo(index)
    {
        io.sockets.emit('deleteVideoSync', index);
    }
    
    // Check if video is already on list
    function checkDupeVideo(videoId)
    {
        for (var i = 0; i < videoList.length; i++)
        {
            if (videoId == videoList[i].id)
            {
                sendServerMsgUser("Video is already on playlist");
                return true;
            }
        }
        return false;
    }
    
    // Check if a user's name is already taken
    function checkDupeUser(user)
    {
        for (var i = 0; i < userList.length; i++)
        {
            if (user == userList[i].name)
            {
                return true;
            }
        }
        return false;
    }
    
    // Check if a user is in the room
    function userInList(user)
    {
        for (var i = 0; i < userList.length; i++)
        {
            if (user == userList[i].name)
            {
                return true;
            }
        }
        return false; 
    }
    
    // Get's a user's data (name, id) by name
    function getUserByName(name)
    {
        for (var i = 0; i < userList.length; i++)
        {
            if (name == userList[i].name)
            {
                return userList[i];
            }
        }
        return null;
    }
    
    // Get's a user's data (name, id) by id
    function getUserById(id)
    {
        for (var i = 0; i < userList.length; i++)
        {
            if (id == userList[i].id)
            {
                return userList[i];
            }
        }
        return null;
    }
    
    // Sends master user current room settings
    function sendRoomSettings()
    {
        if (masterUser == "")
        {
            return;
        }
        
        var settingsData = 
        {
            "settingLockPlaylist":      playlistLocked,
            "settingVideoVoting":       videoVotingEnabled,
            "settingAllowSkips":        skippingEnabled,
            "settingSkipByPercent":     skipUsePercent,
            "settingSkipByVotes":       !skipUsePercent,
            "skipPercent":              skipPercent,
            "skipVotes":                skipsNeeded,
            "settingVideoVoteAutoplay": videoVotingEnabled,
            "settingNormalUserMaster":  giveMasterToUser
        }
        
        io.sockets.socket(masterUserId).emit('roomSettingsSync', JSON.stringify(settingsData));
    }
    
    // Check if a video is real and will add it to the playlist
    // Takes in an array of video info hashes [{id, source}]
    function validateVideo(videos)
    {
        validatedVideos = 0;
        for (var i = 0; i < videos.length; i++)
        {
            var videoId = videos[i].id;
            var source = videos[i].source;
            if (videos[i].source == "yt")
            {
                request('http://gdata.youtube.com/feeds/api/videos/'+ videoId +'?v=2&alt=jsonc', function (error, response, body) 
                {
                    if (!error && response.statusCode == 200) 
                    {
                        var responseObj = JSON.parse(body);
         
                        var videoObj = {id: responseObj.data.id, title: responseObj.data.title, duration: String(responseObj.data.duration), addedBy: username, source: "yt"};
                        
                        videoList.push(videoObj);
                        
                        validatedVideos += 1;
                        if (validatedVideos == videos.length)
                        {
                            if (videos.length == 1)
                            {
                                sendServerMsgUser("Video added successfully! :D");
                                sendServerMsgOther(username + " added " + "\"" + videoObj.title  + "\"");
                                io.sockets.emit('addVideoSync', videoObj);
                            }
                            else
                            {
                                sendServerMsgUser("Playlist loaded successfully! :D");
                                syncVideoList();
                            }
                            savePlaylist();
                        }
                    }
                    else
                    {
                        sendServerMsgUser("Error: Video not valid or no longer exists (YouTube ID: " + videoId + ")");
                        console.log("Error: Video not valid or no longer exists (YouTube ID: " + videoId + ")");
                    }
                });
            }
            else if (videos[i].source == "dm")
            {
                request('https://api.dailymotion.com/video/'+ videoId +'?fields=id,title,duration,user', function (error, response, body) 
                {
                    if (!error && response.statusCode == 200) 
                    {
                        var responseObj = JSON.parse(body);
                        
                        var videoObj = {id: responseObj.id, title: responseObj.title, duration: String(responseObj.duration), addedBy: username, source: "dm"};
                        
                        videoList.push(videoObj);
                        
                        validatedVideos += 1;
                        if (validatedVideos == videos.length)
                        {
                            if (videos.length == 1)
                            {
                                sendServerMsgUser("Video added successfully! :D");
                                sendServerMsgOther(username + " added " + "\"" + videoObj.title  + "\"");
                                io.sockets.emit('addVideoSync', videoObj);

                            }
                            else
                            {
                                sendServerMsgUser("Playlist loaded successfully! :D");
                                syncVideoList();
                            }
                            savePlaylist();
                        }
                    }
                    else
                    {
                        sendServerMsgUser("Error: Video not valid or no longer exists (DailyMotion ID: " + videoId + ")");
                        console.log("Error: Video not valid or no longer exists (DailyMotion ID: " + videoId + ")");
                    }
                });
            }
        }
    }
    
    // Updates a user's name
    function updateUsername(newName)
    {
        var oldName = username;
        var superuserData;
        var userType = USER_TYPE.normal;

        for (var i = 0; i < userList.length; i++)
        {
            if (username == userList[i].name)
            {
                userList[i].name = newName;
                
                // Check if name is in admin list
                if (adminList.indexOf(newName) != -1)
                {
                    userList[i].userType = USER_TYPE.admin;
                    userType = USER_TYPE.admin;
                    break;
                }
                
                // Check if name is in mod list
                if (modList.indexOf(newName) != -1)
                {
                    userList[i].userType = USER_TYPE.mod;
                    userType = USER_TYPE.mod;
                    break;
                }
            }
        }

        for (var i = 0; i < userInfo.length; i++)
        {
            if (username == userInfo[i].name)
            {
                userInfo[i].name = newName;
                userInfo[i].userType = userType;
                break;
            }
        }

        socket.username = newName;
        username = socket.username;
        
        io.sockets.socket(socket.id).emit('nameSync', username, userType);
        
        if (userType == USER_TYPE.admin)
        {
            io.sockets.socket(socket.id).emit('banSync', banList);
            io.sockets.socket(socket.id).emit('modSync', modList);
        }
        
        sendServerMsgAll("\"" + oldName + "\" is now \"" + username + "\"");
        
        if (oldName == masterUser)
        {
            masterUser = username;
            guestMasterUser = "";
            io.sockets.emit('masterUserSync', masterUser);
        }
        
        if (oldName == guestMasterUser)
        {
            guestMasterUser = username;
            io.sockets.emit('guestMasterUserSync', guestMasterUser);
        }
        
        // Set mods as master user
        if (masterUser == "" && !giveMasterToUser && userType == USER_TYPE.mod)
        {
            masterUser = username;
            masterUserId = id;
            guestMasterUser = "";
            console.log("masterUser set to " + masterUser);
            
            // Tell/remind everyone who the masterUser is
            io.sockets.emit('masterUserSync', masterUser);
            sendRoomSettings();
        }
        
        syncUserList();
    }
    

    // Send server message to user
    function sendServerMsgUser(msg)
    {
        io.sockets.socket(socket.id).emit('serverMsg', msg);
    }
    
    // Send server message to everyone
    function sendServerMsgAll(msg)
    {
        io.sockets.emit('serverMsg', msg);
    }
    
    // Send server message to everyone except sender
    function sendServerMsgOther(msg)
    {
        socket.broadcast.emit('serverMsg', msg);
    }
    
    // Sends a server message to a specific user
    function sendServerMsgSpecific(msg, user)
    {
        var targetId = socketIdByName(user);
        if (targetId)
        {
            io.sockets.socket(targetId).emit('serverMsg', msg);
        }
    }
    
    // Send masterUser pause message to everyone
    function sendPlayPause(paused)
    {
        socket.broadcast.emit('masterVideoPause', paused);
    }
    
    // Send everyone the id of the video to immediately change to on the playlist
    function sendVideoChange(videoId)
    {
        // Reset votes, if any
        if (videoVotes[videoId])
        {
            var index = indexById(videoId);
            if (index > -1)
            {
                delete videoVotes[videoId];
                
                // Reset video vote properties
                for (var i = 0; i < userList.length; i++)
                {
                    if (userList[i].votedVideo == videoId)
                    {
                        userList[i].votedVideo = '';
                    }
                }
                
                io.sockets.emit('videoVoteSync', index, '0');
            }
        }
        
        io.sockets.emit('videoChangeSync', videoId);
    }
    
    // Send everyone the id of master's current video 
    function sendCurrentVideo()
    {
        var curVidIndex;
        var source;
        
        if (!videoIsStream)
        {
            curVidIndex = indexById(currentVideo);
            source = videoList[curVidIndex].source;
        }
        else
        {
            source = streamSource;
        }
        
        io.sockets.emit('videoSync', currentVideo, source);
    }
    
    // Swap elements in an array by index
    function arraySwap(arr, index1, index2)
    {
        var b = arr[index1];
        arr[index1] = arr[index2];
        arr[index2] = b;
    }
    
    // Get index of video by id
    function indexById(videoId)
    {
        for (var i = 0; i < videoList.length; i++)
        {
            if (videoId == videoList[i].id)
            {
                return i;
            }
        }
        return -1;
    }
    
    // Make new user room master
    function masterUserPassOff(user)
    {
        if (userInList(user))
        {
            console.log("inlist");
            var userData = getUserByName(user);
            if (userData)
            {
                masterUser = userData.name;
                masterUserId = userData.id;
                guestMasterUser = "";
                io.sockets.emit('masterUserSync', masterUser);
                sendServerMsgAll("MasterUser is now \"" + masterUser + "\"");
            }
        }
        else
        {
            sendServerMsgUser("That user is no longer available.")
        }
    }
    
    // Shuffle the elements in an array
    function shuffleArray(array) 
    {
        for (var i = array.length - 1; i > 0; i--) 
        {
            var j = Math.floor(Math.random() * (i + 1));
            var temp = array[i];
            array[i] = array[j];
            array[j] = temp;
        }
        return array;
    }
    
    /**
      Check that user isn't banned or spamming. Validate EVERY message received.
      Differentiate between chat messages and server messages
      Message types: "chat", "server"
      @param msgVars Array of message arguments to validate
      @return true if check passes, false to drop/ignore message
     */
    function spammingCheck(msgVars, msgType)
    {   
        // Malformed message detected
        if (msgVars != 0 && (!msgVars || msgVars.length == 0))
        {
            console.log("Received malformed message from " + username + " [" + ip + "]");
            socket.disconnect();
            return;
        }
    
        // Disconnect immediately if banned
        if (objectWithKeyAndValue(banList, 'ip', ip))
        {
            sendServerMsgUser("BANNED");
            socket.disconnect();
            return;
        }
        
        // Disconnect immediately if message size is massive
        var messageSize = 0;
        for (var i = 0; i < msgVars.length; i++)
        {
            if (msgVars[i])
            {
                messageSize += msgVars[i].length;
            }
        }
        
        if (messageSize > MSG_MAX_SIZE)
        {
            console.log("Received Xbox hueg message from " + username + " [" + ip + "]");
            socket.disconnect();
            return;
        }
        
        var now = new Date();
        var user = getUserById(userId);
        var lastTime = user.lastSpamCheck;
        
        if (user)
        {
            
            if (!lastTime || !user.lastSpamCheck)
            {
                lastTime = now;
                user.lastSpamCheck = now;
            }
            
            // Increment message counter(s)
            if (msgType == "chat")
            {
                user.chatMsgCount += 1;
            }
            
            user.msgCount += 1; // Chat messages count as server messages
            
            var timeDelta = Math.abs(now.getTime() - lastTime.getTime());
            
                /*console.log("Time diff:" + timeDelta);
                console.log("Msg:" + user.msgCount);
                console.log("Chat msg:" + user.chatMsgCount);*/

            
            if (timeDelta > SPAM_CHECK_TIME)
            {   
                var msgCount = user.msgCount;
                var chatMsgCount = user.chatMsgCount;
                
                // Reset message counts
                user.chatMsgCount = 0;
                user.msgCount = 0;
                user.lastSpamCheck = now;
                
                // Check message counts
                if (chatMsgCount > SPAM_CHAT_THRESH)
                {
                    console.log(username + " seems to be spamming the chat");
                    
                    // Mute/warn user or ban if already warned
                    socket.disconnect();
                    return;
                }
                else if (msgCount > SPAM_MSG_THRESH)
                {
                    console.log("Receiving an absurd number of messages from " + username);
                    
                    // Disconnect and/or ban
                    socket.disconnect();
                    return;
                }
                
            }
        }
    }
    
    function toggleUserSkip()
    {
        var idx = skipList.indexOf(username);
        if (idx > -1)
        {
            // Remove from skip list
            skipList.splice(idx, 1);
        }
        else
        {
            // Add to skip list
            skipList.push(username);
        }
        
        syncSkips();
    }
    
    function syncSkips()
    {
        // Check skips
        var skips = skipList.length;
        if (skipUsePercent)
        {
            skipsNeeded = Math.ceil(userList.length * (skipPercent/100));
        }
        
        if (skips >= skipsNeeded && skipsNeeded > 0)
        {
            // Automatically go to next video
            console.log("Skip limit reached, skipping video");
            var videoIdx = indexById(currentVideo);
            
            // Override for skipping streams
            if (videoIdx < 0 && videoList.length > 0)
            {
                videoIdx = 0;
            }
            
            if (videoIdx > -1)
            {
                var nextVideo;
                if (videoIdx >= videoList.length - 1)
                {
                    nextVideo = videoList[0].id;
                }
                else
                {
                    nextVideo = videoList[videoIdx + 1].id;
                }

                if (nextVideo)
                {
                    videoIsStream = false;
                    currentVideo = nextVideo;
                    sendVideoChange(currentVideo);
                    sendCurrentVideo();
                    // Reset skips
                    skipList = [];
                }
            }
        }
        
        // Tell everyone about skips
        io.sockets.emit('skipSync', skipList.length, skipsNeeded);
    }
    
    // Toggles a vote on a video
    function toggleUserVideoVote(videoId)
	{
        var videoIndex = indexById(videoId);
        if (videoIndex == -1)
        {
            // Couldn't find video in list
            console.log("Error: attempted to vote on non-existent video [" + videoId + "]");
            return;
        }
        
        var user = getUserById(userId);
        if (user)
        {               
            if (!user.votedVideo || user.votedVideo.length == 0)
            {
                if (!videoVotes[videoId])
                {
                    videoVotes[videoId] = 1;
                }
                else
                {
                    videoVotes[videoId] += 1;
                }
                
                user.votedVideo = videoId;
            }
            else if (user.votedVideo == videoId)
            {
                videoVotes[videoId] -= 1;
                user.votedVideo = "";
            }
        }
        
        if (videoVotes[videoId] == 0)
        {
            // Remove video from vote list
            delete videoVotes[videoId];
        }
        
        var voteCount = videoVotes[videoId] ? videoVotes[videoId] : 0; 
        
        // Tell everyone about the vote change
        io.sockets.emit('videoVoteSync', videoIndex, voteCount);
    }    
        
    // Detects and executes a command
    // Returns null if nothing detected
    function detectCommand(queryString)
    {   
        var now = new Date(); 

        // First slash character means command
        if (queryString.length == 0 || queryString.substr(0, 1) != '/')
        {
            return null;
        }
        
        var command = queryString.split(' ');
        switch (command[0].replace('/', ''))
        {
            // Whisper: /w [target] [message] :: /w user32 You suck
            case 'w':
                var target = command[1];
                // Remove first two elements (command and target)
                command.shift();
                command.shift();
                var message = "";
                for (var i = 0; i < command.length; i++)
                {
                    message += command[i] + " "; // Re-insert space
                }
                
                var targetId = socketIdByName(target);
                if (targetId)
                {
                    var chatLine = {username: username, text: message, timestamp: now.toUTCString(), whisper: true, whisperTarget: target};
                    io.sockets.socket(socket.id).emit('chatSync', chatLine);
                    io.sockets.socket(targetId).emit('chatSync', chatLine);
                }
                break;
            default:
                sendServerMsgUser("Invalid command");
                return null;
        }
        
        return true;
    }
    
    // Gets a user's socket id by username
    function socketIdByName(name)
    {
        for (var i = 0; i < userList.length; i++)
        {
            if (userList[i].name == name)
            {
                return userList[i].id;
            }
        }
        
        return null;
    }
    
    // Executes a command from the given path every X seconds (POTENTIALLY INSECURE?)
    // Deletes the file when finished
    function extCmd(timeout)
    {
        // Send a server message
        fs.exists('msg.txt', function (exists) 
        {
            if (exists)
            {
                fs.readFile('msg.txt', 'utf-8', function (err, data) 
                {
                    if (err)
                    {
                        console.log(err);
                    }
                    else if (data.length > 0)
                    {
                        sendServerMsgAll(data);
                        fs.unlink('msg.txt', function(){});
                    }
                });
            }
        });
        
        commandTimer = setTimeout(function() 
        {
            extCmd(timeout);
        }, timeout);
    }
    
    // Searches in hashArray for a hash with the key value pair
    // Returns first object with match, null otherwise
    function objectWithKeyAndValue(hashArray, key, value)
    {
        for (var i = 0; i < hashArray.length; i++)
        {
            //console.log(hashArray[i]['ip']);
            if (hashArray[i][key] == value)
            {
                return hashArray[i];
            }
        }
        return null;
    }
    
    // Adds someone to the ban list
    function banUser(socketId, banReason, banLength)
    {
        var user = objectWithKeyAndValue(userList, 'id', socketId);
        if (!user)
        {
            console.log("Couldn't ban user: user with that id not found");
            return null;
        }
        
        var now = new Date();
        
        // Save name only if tripped
        var name = user.name;
        if (name.indexOf('!') == -1)
        {
            name = '';
        }
        
        var banItem = {ip: user.ip, lastName: name, banDate: now, expiration: banLength, reason: banReason};
        
        banList.push(banItem);
        
        io.sockets.socket(socket.id).emit('banSync', banList);
        
        saveBanList();
        console.log('[' + user.ip + '] was BANNED');
    }
    
    // Removes someone from the ban list by ip or name
    function unbanUser(ip, name)
    {
        if (ip)
        {
            var user = objectWithKeyAndValue(banList, 'ip', ip);
            if (user)
            {
                var index = banList.indexOf(user);
                banList.splice(index, 1);
                sendServerMsgUser("You unbanned " + ip);
                io.sockets.socket(socket.id).emit('banSync', banList);
                saveBanList();
                console.log('[' + ip + '] was unbanned');
                return;
            }
        }
        else if (name)
        {
            var user = objectWithKeyAndValue(banList, 'lastName', name);
            if (user)
            {
                var index = banList.indexOf(user);
                banList.splice(index, 1);
                sendServerMsgUser("You unbanned " + name);
                io.sockets.socket(socket.id).emit('banSync', banList);
                saveBanList();
                console.log('[' + name + '] was unbanned');
                return;
            }
        }
        
        sendServerMsgUser("Unable to unban that user");
        console.log("Couldn't unban user: user with that ip or name not found");
    }
    
    // Adds someone to the mod list
    function modUser(trip)
    {
        if (trip)
        {
            if (modList.indexOf(trip) == -1)
            {
                modList.push(trip);
                console.log('[' + trip + '] has been modded');
                sendServerMsgSpecific("You have been modded! Hooray!", trip);
                sendServerMsgAll(trip + " has been modded!");
                io.sockets.socket(socket.id).emit('modSync', modList);
                saveModList();
                updateUserType(trip);
            }
            else
            {
                sendServerMsgUser("That user is already a mod");
            }
        }
        else
        {
            console.log("Can't mod nobody");
        }
    }
    
    // Removes someone from the mod list
    function unmodUser(trip)
    {
        var mod = modList.indexOf(trip);
        if (mod > -1)
        {
            modList.splice(mod, 1);
            sendServerMsgUser("You unmodded " + trip);
            io.sockets.socket(socket.id).emit('modSync', modList);
            console.log('[' + trip + '] was unmodded');
            saveModList();
            updateUserType(trip);
        }
        else
        {
            sendServerMsgUser("Unable to unmod " + trip);
            console.log('[' + trip + '] could not be found in mod list');
        }
    }
    
    // Updates user's type in info and syncs
    function updateUserType(name)
    {
        var userType = USER_TYPE.normal;
        
        // Update userList
        for (var i = 0; i < userList.length; i++)
        {
            if (name == userList[i].name)
            {
                // Check if name is in admin list
                if (adminList.indexOf(name) != -1)
                {
                    userList[i].userType = USER_TYPE.admin;
                    userType = USER_TYPE.admin;
                    break;
                }
                
                // Check if name is in mod list
                if (modList.indexOf(name) != -1)
                {
                    userList[i].userType = USER_TYPE.mod;
                    userType = USER_TYPE.mod;
                    break;
                }
            }
        }
        
        // Update userInfo
        for (var i = 0; i < userInfo.length; i++)
        {
            if (name == userInfo[i].name)
            {
                userInfo[i].userType = userType;
                break;
            }
        }
        
        syncUserList();
        
        // Tell user about new type
        var id = socketIdByName(name);
        io.sockets.socket(id).emit('userTypeSync', userType);
        
        return userType;
    }
    
    // Picks a random user to be a guest master user
    function findGuestMasterUser()
    {
        if (userList.length == 0 || guestMasterUser.length > 0 || !giveMasterToUser)
        {
            return;
        }
        
        var index = Math.floor(Math.random() * userList.length);
        var guest = userList[index].name;
        guestMasterUser = guest;
        console.log("Guest master user is now " + guest);
        io.sockets.emit('guestMasterUserSync', guest);
    }
    
    /****END SERVER FUNCTIONS***************/
    
    if (!commandTimer)
    {
        extCmd(COMMAND_TIMEOUT);
    }
    
    // Disconnect if IP is in banList
    if (objectWithKeyAndValue(banList, 'ip', ip))
    {
        sendServerMsgUser("BANNED");
        socket.disconnect();
        return;
    }

    // Disconnect if room is full
    if (userList.length >= MAX_USERS)
    {
        sendServerMsgUser("Sorry, the room is full right now");
        socket.disconnect();
    }
    
    
    // Always assign a username on connection
    if (!username || username.length == 0)
    {
        // Keep a running count for keying purposes
        userCount++;
        socket.username = "user" + userCount;
        username = socket.username;
        id = socket.id;
        ip = socket.handshake.address.address;
        
        // This will be the only real means of auth without registration
        // Ignore messages if socket id doesn't match username
        var user = {name: username, id: socket.id, ip: ip, lastSpamCheck: null, msgCount: 0, chatMsgCount: 0, lastChatEmbed: null, lastShuffle: null};
        userList.push(user);
        
        // Maintain a list without sensitive info (to send to everyone else)
        user = {name: username, userType: USER_TYPE.normal};
        userInfo.push(user);
        
        // Send new guy current state of chat (last X lines)
        io.sockets.socket(socket.id).emit('chatLogSync', chatLog);
        
        // Send new guy current state of playlist
        io.sockets.socket(socket.id).emit('videoListSync', videoList);
        
        // Tell new guy his new name
        io.sockets.socket(socket.id).emit('nameSync', username);
        
        // Update skips
        syncSkips();
          
        // Send current video, if exists
        if (currentVideo != "" && videoList.length > 0)
        {
            var curVidIndex;
            var source;
            
            if (!videoIsStream)
            {
                curVidIndex = indexById(currentVideo);
                source = videoList[curVidIndex].source;
            }
            else
            {
                source = streamSource;
            }
            
            io.sockets.socket(socket.id).emit('videoSync', currentVideo, source);
        }
        
        // Make new guy masterUser if there isn't one (if allowed)
        if (masterUser == "" && giveMasterToUser)
        {
            masterUser = username;
            masterUserId = id;
            guestMasterUser = "";
            console.log("masterUser set to " + masterUser);
            io.sockets.emit('masterUserSync', masterUser);
            sendRoomSettings();
        }
        else
        {
            if (guestMasterUser.length == 0)
            {
                findGuestMasterUser();
            }
            else
            {
                io.sockets.emit('guestMasterUserSync', guestMasterUser);
            }
        }
    }
    
    console.log(username + " connected");

    // Update userList
    syncUserList();
    
    // Message for sending everyone masterUser's current video time
	socket.on('masterTimeSync', function (time) 
    {
        spammingCheck([time], "");
    
        // Validation
        if (validUser() && isFloat(time) && (isMasterUser() || isAdmin()))
        {
            masterTime = time;
            //console.log("Time: " + time + " from " + masterUser + "\n");
           
            if (userList.length > 1)
            {
                socket.broadcast.emit('playerTimeSync', time);
            }
        }
	});
    
    // Message for sending everyone guestMasterUser's current video time
	socket.on('guestMasterTimeSync', function (time) 
    {
        spammingCheck([time], "");
    
        // Validation
        if (validUser() && isFloat(time))
        {
            masterTime = time;
            //console.log("Time: " + time + " from " + masterUser + "\n");
           
            if (userList.length > 1)
            {
                socket.broadcast.emit('playerTimeSync', time);
            }
        }
	});
    
    // Message for updating everyone's chat with a message
	socket.on('chatSync', function (text) 
    {
        spammingCheck([text], "chat"); 

        if (validUser())
        {   
            // Convert timestamp to UTC
            var now = new Date(); 

            text = htmlEscape(text);
            
            if (text.length == 0 || text.length > CHAT_MSG_MAX_SIZE)
            {
                return;
            }
            
            // Perform command and then finish
            if (detectCommand(text))
            {
                return;
            }
            
            // Check if Tinypic embed
            var tinypicImage = text.match(/(http:\/\/.*.tinypic.com\/.*(.jpg|.gif|.png))/);
            var tinypicVideo = text.match(/http:\/\/tinypic.com\/r\/(.*)\/(\d*)/);
            if (tinypicImage || tinypicVideo)
            {
                var user = getUserById(userId);
                if (user)
                {
                    if (user.lastChatEmbed)
                    {
                        var lastTime = user.lastChatEmbed;
                        user.lastChatEmbed = now;
                        var timeDelta = Math.abs(now.getTime() - lastTime.getTime()) / 1000;
                        var waitTime = COOLDOWN_CHAT_EMBED - timeDelta;
                        if (timeDelta < COOLDOWN_CHAT_EMBED)
                        {
                            sendServerMsgUser("Please wait [" + waitTime + "] seconds before posting another image/video");
                            return;
                        }
                    }
                    else
                    {
                        user.lastChatEmbed = now;
                    }
                }   
            }
            
            var chatLine = {username: username, text: text, timestamp: now.toUTCString(), whisper: false, whisperTarget: false};
            io.sockets.emit('chatSync', chatLine);
            
            // Save in my chat log, formatting should be independent
            chatLog.push(chatLine);
            
            // Only log n lines. Don't want to send a book everytime someone joins.
            if (chatLog.length > CHATLOG_MAX_SIZE)
            {
                chatLog.splice(0, 1);
            }
        }    
        
	});

    // Message for state change of playerTimeSync
    socket.on('playerStateChange', function (state) 
    {
        spammingCheck([state], "");
    
        if (validUser() && (isMasterUser() || isAdmin()))
        {
            if (isMasterUser())
            {
                switch (state)
                {
                case PLAYER_STATE_TYPE.finished:
                    if (videoVoteMode)
                    {
                        nextVideoByVotes();
                    }
                    else
                    {
                        nextVideo();
                    }
                
                    //console.log("Got finish message from " + username);
                    //finishedUsers['name'] = username;
                    //console.log(Object.keys(finishedUsers).length);
                    break;
                case PLAYER_STATE_TYPE.playing:
                    paused = false;
                    sendPlayPause(paused);
                    break;
                case PLAYER_STATE_TYPE.paused:
                    paused = true;
                    sendPlayPause(paused);
                    break;
                default:
                }
            }
        }
	});   
    
    // Message for adding a video to the playlist
 	socket.on('addVideo', function (url) 
    {
        spammingCheck([url], "");        
     
        if (videoList.length >= MAX_VIDEOS)
        {
            sendServerMsgUser("Sorry, playlist is full");
            return;
        }
    
        if (playlistLocked)
        {
            sendServerMsgUser("Sorry, playlist is locked");
            return;
        }
    
        var videoId;
        var sourceType;
        var ytIdMatch = url.match(/(\?v=([a-zA-Z0-9_-]{11}))/);
        var dmIdMatch = url.match(/video\/([^_]+)/);
        var usIdMatch = url.match(/ustream.tv\/channel\/(\d+)/);
        var lsIdMatch = url.match(/livestream.com\/(\w+)/);
        var twIdMatch = url.match(/twitch.tv\/(\w+)/);
        
        if (ytIdMatch)
        {
            videoId = ytIdMatch[2];
            sourceType = "yt";
        }    
        else if (dmIdMatch)
        {
            videoId = dmIdMatch[1];
            sourceType = "dm";
        }
        else if (usIdMatch)
        {
            videoId = usIdMatch[1];
            sourceType = "us";
        }
        else if (lsIdMatch)
        {
            videoId = lsIdMatch[1];
            sourceType = "ls";
        }
        else if (twIdMatch)
        {
            videoId = twIdMatch[1];
            sourceType = "tw";
        }
        
        if (!videoId)
        {
            sendServerMsgUser("Not a valid video URL");
            return;
        }
        
        if (validUser() && sourceType && !checkDupeVideo(videoId))
        {
            if (sourceType != "us" && sourceType != "ls" && sourceType != "tw")
            {
                var vidInfo = [];
                vidInfo.push({id: videoId, source: sourceType});
                validateVideo(vidInfo);
            }
            else
            {
                // Auto load streams, but check for masterUser
                if (validUser() && (isMasterUser() || isAdmin()))
                {
                    videoIsStream = true;
                    currentVideo = videoId;
                    streamSource = sourceType;
                    sendCurrentVideo();
                }
                else
                {
                    sendServerMsgUser("Sorry, normal users cannot load streams");
                }
            }
        }
	});   
   
    // Message for requesting a name change
    socket.on('requestNameChange', function (newName)
    {
        spammingCheck([newName], "");
        
        if (validUser())
        {
            newName = htmlEscape(newName);
            
            if (!newName)
            {
                return;
            }
        
            if (!newName.match(/^[0-9a-z#]+$/i))
            {
                sendServerMsgUser("Name must be alphanumeric only");
                return;
            }
            
            if (newName.length > 15)
            {
                sendServerMsgUser("Name cannot be longer than 15 characters");
                return;
            }
            
            if (newName.length < 3)
            {
                sendServerMsgUser("Name must be longer than 2 characters");
                return;
            }
            
            if (newName.match(/#/g))
            {
                var split = newName.split("#");
                var namePortion = split.shift();
                var rejoined = split.join("");
                var trip = generateTrip(namePortion + rejoined);
                newName = namePortion + "!" + trip;
            }
        
            if (!checkDupeUser(newName))
            {
                updateUsername(newName);
            }
            else
            {
                sendServerMsgUser("Name already in use, bitch");
            }
        }
    });
    
    // Message for setting current video from master
    socket.on('masterVideoIdSync', function (videoId)
    {
        spammingCheck([videoId], "");
    
        if (validUser() && (isMasterUser() || isAdmin()))
        {
            videoIsStream = false;
            currentVideo = videoId;
            sendCurrentVideo();
        }
    });
    
    // Message for sending a video change message from master
    socket.on('masterVideoSync', function (videoId)
    {
        spammingCheck([videoId], "");
        
        if (validUser() && (isMasterUser() || isAdmin()))
        {
            videoIsStream = false;
            currentVideo = videoId;
            sendVideoChange(currentVideo);
            sendCurrentVideo();
        }
    });
    
    // Message for updating the video list when a video is moved
    socket.on('videoListMove', function (index1, index2)
    {
        spammingCheck([index1, index2], "");
    
        if (validUser() && (isMasterUser() || isAdmin()))
        {
            var savedObj = videoList.splice(index2, 1);
            if (savedObj[0])
            {
                videoList.splice(index1, 0, savedObj[0]);
                io.sockets.emit('moveVideoSync', index1, index2);
                savePlaylist();
            }
        }
    });
    
    // Message for updating the video list when master deletes a video
    socket.on('deleteVideo', function (videoIndex)
    {
        spammingCheck([videoIndex], "");
        
        if (validUser() && (isMasterUser() || isAdmin()))
        {
            // Delete from vote list
            var videoId = videoList[videoIndex].id;
            if (videoVotes[videoId])
            {
                delete videoVotes[videoId];
                
                // Reset video vote properties
                for (var i = 0; i < userList.length; i++)
                {
                    if (userList[i].votedVideo == videoId)
                    {
                        userList[i].votedVideo = '';
                    }
                }
            }
        
            videoList.splice(videoIndex, 1);
            syncDeleteVideo(videoIndex);
            savePlaylist();
        }
    });
    
    // Message for clearing the video list
    socket.on('clearVideoList', function ()
    {
        spammingCheck(0, "");
        
        if (validUser() && (isMasterUser() || isAdmin()))
        {
            videoList = [];
            syncVideoList();
        }
    });
    
    // Message for cleaning the video list (delete until current video)
    socket.on('cleanVideoList', function ()
    {
        spammingCheck(0, "");
        
        if (validUser() && (isMasterUser() || isAdmin()))
        {
            var curVidIndex = indexById(currentVideo);
            if (curVidIndex > -1)
            {
                videoList.splice(0, curVidIndex);
                syncVideoList();
            }
        }
    });
   
    // Message for shuffling the video list
    socket.on('shuffleVideoList', function ()
    {
        spammingCheck(0, "");
        if (validUser() && (isMasterUser() || isAdmin()))
        {
            videoList = shuffleArray(videoList);
            syncVideoList();
        }
    });
    
    // Message for loading a playlist from a string of ids
    socket.on('loadPlaylist', function (playlistStr)
    {
        spammingCheck(0, "");
        if (validUser() && (isMasterUser() || isAdmin()))
        {
            var urls = playlistStr.match(/(\?v=([a-zA-Z0-9_-]{11}))|(video\/([^\W|_]+))/g);
            
            if (!urls)
            {
                sendServerMsgUser("Invalid URL(s)");
                return;
            }
            
            var videosToValidate = [];
            for (var i = 0; i < urls.length; i++)
            {

                if (videoList.length >= MAX_VIDEOS)
                {
                    sendServerMsgUser("Sorry, playlist is full");
                    return;
                }
            
                var videoId;
                var sourceType;
                var ytIdMatch = urls[i].match(/\?v=([a-zA-Z0-9_-]{11})/);
                
                if (ytIdMatch)
                {
                    videoId = ytIdMatch[1];
                    sourceType = "yt";
                    if (!checkDupeVideo(videoId))
                    {
                        videosToValidate.push({id: videoId, source: sourceType});
                    }
                }
                else
                {
                    //var removedTitle = splitStr[i].replace(/_.*/, "");
                    var dmIdMatch = urls[i].match(/video\/([^\W|_]+)/);
                    if (dmIdMatch)
                    {
                        videoId = dmIdMatch[1];
                        sourceType = "dm";
                        if (!checkDupeVideo(videoId))
                        {
                            videosToValidate.push({id: videoId, source: sourceType});
                        }
                    }
                }
            }
            
            if (videosToValidate.length > 0)
            {
                validateVideo(videosToValidate);
            }
        }
    });

    // Message for changing the master user
    socket.on('masterUserPassOff', function (user)
    {
        spammingCheck([user], "");

        if (validUser() && (isMasterUser() || isAdmin() || isMod()))
        {
            masterUserPassOff(user);
        }
    });

    // Message for toggling a skip
    socket.on('toggleSkip', function ()
    {
       spammingCheck(0, "");

       if (validUser())
       {
           toggleUserSkip();
       }
    });
    
    // Message for toggling a video vote
    socket.on('toggleVideoVote', function (videoId)
    {
    	spammingCheck([videoId], "");

       if (validUser() && videoVotingEnabled)
       {
           toggleUserVideoVote(videoId);
       }
    });
        
    // Message for enabling/disabling skipping
    socket.on('toggleSkippingEnabled', function (enabled)
    {
        spammingCheck([enabled], "");
        
        if (validUser() && (isMasterUser() || isAdmin()) && skippingEnabled == !enabled)
        {
        
            skippingEnabled = enabled;
            io.sockets.emit('skipEnabledSync', enabled);
            saveSettings();
        }
    });
    
    // Message for enabling/disabling playlist lock
    socket.on('togglePlaylistLocked', function (locked)
    {
        spammingCheck([locked], "");
        
        if (validUser() && (isMasterUser() || isAdmin()) && playlistLocked == !locked)
        {
        
            playlistLocked = locked;
            io.sockets.emit('lockPlaylistSync', locked);
            saveSettings();
        }
    });
    
    // Message for enabling/disabling video voting
    socket.on('toggleVideoVoting', function (enabled)
    {
        spammingCheck([enabled], "");
        
        if (validUser() && (isMasterUser() || isAdmin()) && videoVotingEnabled == !enabled)
        {
        
            videoVotingEnabled = enabled;
            io.sockets.emit('videoVotingSync', enabled);
            saveSettings();
        }
    });
    
    // Message for enabling/disabling video vote autoplaying
    socket.on('toggleVideoVoteAutoplay', function (enabled)
    {
        spammingCheck([enabled], "");
        
        if (validUser() && (isMasterUser() || isAdmin()) && videoVoteMode == !enabled)
        {
            videoVoteMode = enabled;
            console.log("Video vote autoplay changed to: " + enabled);
            saveSettings();
        }
    });
    
    // Message for allowing normal users to be master users
    socket.on('toggleNormalUserMaster', function (enabled)
    {
        spammingCheck([enabled], "");
        
        if (validUser() && (isMasterUser() || isAdmin()) && giveMasterToUser == !enabled)
        {
            giveMasterToUser = enabled;
            console.log("Give master to user: " + enabled);
            saveSettings();
        }
    });
    
    // Message for enabling/disabling skipping
    socket.on('updateSkipSettings', function (usePercent, skipValue)
    {
        spammingCheck([usePercent, skipValue], "");
        
        if (validUser() && (isMasterUser() || isAdmin()))
        {
            skipUsePercent = usePercent;
            if (usePercent)
            {
                if (skipValue > 0 && skipValue < 100)
                {
                    skipPercent = skipValue;
                }
            }
            else
            {
                if (skipValue > 0 && skipValue < 999)
                {
                    skipsNeeded = skipValue;
                }
            }
            
            syncSkips();
            saveSettings();
        }
    });
    
    // Message for booting a user
    socket.on('bootUser', function (name)
    {
        spammingCheck([name], "");
        
        if (validUser() && ((isMasterUser() || isAdmin()) || isMod()))
        {
            var targetId = socketIdByName(name);
            if (targetId)
            {
                // Master user privs
                if (isMasterUser() && (adminList.indexOf(name) > -1 || modList.indexOf(name) > -1))
                {
                    sendServerMsgUser("You can't boot an admin or mod");
                    return;
                }
                
                // Mod privs
                if (isMod() && adminList.indexOf(name) > -1)
                {
                    sendServerMsgUser("You can't boot an admin");
                    return;
                }
                
                // TODO: Take master if booting master user
                
                sendServerMsgSpecific("You have been booted!", name);
                io.sockets.socket(targetId).disconnect();
            }
        }
    });
    
    // Message for banning a user
    socket.on('banUser', function (name, reason, banLength)
    {
        spammingCheck([name, reason, banLength], "");
        
        if (validUser() && (isAdmin() || isMod()))
        {   
            var targetId = socketIdByName(name);
            if (targetId)
            {
                if (isMod() && adminList.indexOf(name) > -1)
                {
                    sendServerMsgUser("You can't ban an admin");
                    return;
                }
            
                banUser(targetId, reason, banLength);
                sendServerMsgSpecific("You have been banned!", name);
                
                if (reason && reason.length > 0)
                {
                    sendServerMsgSpecific("Ban reason: " + reason, name);
                }
                
                if (banLength && banLength.length > 0 || banLength > 0)
                {
                    sendServerMsgSpecific("Your ban will expire in " + banLength + " days", name);
                }
                else
                {
                    sendServerMsgSpecific("Your ban will not expire", name);
                }
                
                io.sockets.socket(targetId).disconnect();
            }
        }
    });
    
    // Message for modding a user, mod requires trip
    socket.on('modUser', function (trip)
    {
        spammingCheck([trip], "");
        
        if (validUser() && (isAdmin() || isMod()))
        {
            // Detect trip, mods must have a tripcode
            if (trip.indexOf('!') == -1)
            {
                sendServerMsgUser("Mods must use a tripcode");
                return;
            }
        
            var targetId = socketIdByName(trip);
            if (targetId)
            {
                modUser(trip);
            }
        }
    });
    
    
    // Message for unbanning a user
    socket.on('unbanUser', function (ip)
    {
        spammingCheck([ip], "");
        
        if (validUser() && isAdmin())
        {
            unbanUser(ip, null);
        }
    });
    
    // Message for unmodding a user
    socket.on('unmodUser', function (trip)
    {
        spammingCheck([trip], "");
        
        if (validUser() && (isAdmin() || isMod()))
        {
            unmodUser(trip);
        }
    });

    // When a user disconnects
	socket.on('disconnect', function () 
    {        
        // Remove from skip list if in there
        var idx = skipList.indexOf(username);
        if (idx > -1)
        {
            // Remove from skip list
            skipList.splice(idx, 1);
        }
        
        // Remove user's video vote
        var user = getUserById(userId);
        if (user)
        {
            if (user.votedVideo && user.votedVideo.length > 0)
            {
                var videoIndex = indexById(user.votedVideo);
                if (videoIndex > -1)
                {                
                    if (videoVotes[user.votedVideo] && videoVotes[user.votedVideo] > 0)
                    {
                        videoVotes[user.votedVideo] -= 1;
                    }
                    else
                    {
                        delete videoVotes[user.votedVideo];
                    }
                    
                    var voteCount = videoVotes[user.votedVideo] ? videoVotes[user.votedVideo] : 0;
                    io.sockets.emit('videoVoteSync', videoIndex, voteCount);
                }
            }
        }
        
        removeUser(username);
        
        var foundNewMaster = false;
        
        // Need to find a new masterUser if old one left
        if (!userInList(masterUser))
        {
            if (userList.length > 0)
            {
                // Find the first mod, or some user if allowed
                for (var i = 0; i < userList.length; i++)
                {
                    if (userList[i].userType == USER_TYPE.mod)
                    {
                        masterUser = userList[i].name;
                        masterUserId = userList[i].id;
                        guestMasterUser = "";
                        foundNewMaster = true;
                        break;
                    }
                }
                
                if (!foundNewMaster && giveMasterToUser)
                {
                    masterUser = userList[0].name;
                    masterUserId = userList[0].id;
                    guestMasterUser = "";
                }
            }
            else
            {
                masterUser = "";
                masterUserId = "";
                guestMasterUser = "";
            }
            
            io.sockets.emit('masterUserSync', masterUser);
            
            findGuestMasterUser();
            
            sendRoomSettings();
        }
        
        syncUserList();
        syncSkips();
        console.log(username + " disconnected");
	});
});

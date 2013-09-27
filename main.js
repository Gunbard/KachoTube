var playerWidth = 640;
var playerHeight = 385;
var myName = "";
var masterUser = "";
var superUser = false;
var currentVideo = "";
var serverVideo = "";
var socket = io.connect();
var videoPlayer;
var serverMsgFadeDelay = 5000;
var serverMsgFadeTime = 1500;
var videoPlaylist = [];
var playlistTotalTime = 0; // In seconds
var userList = []; // {string name, string trip, bool adminFlag, bool muted, bool dead}
var firstScroll = true;
var origIndex = 0; // Used for sorting
var timeDiff = 5;
var rightClickVid = "";
var APImode = ""; 
// YT = YouTube, DM = DailyMotion, US = UStream, LS = Livestream, TW = Twitch
var chatImgWidth = 120;
var chatImgWidthSm = 80;
var chatImgWidthMed = 120;
var chatImgWidthLg = 160;
var chatVidWidth = 200;
var chatVidHeight = 180;
var NNDHeight = 40;
var NNDInputCursor = -NNDHeight;
var NNDCommentCount = 0;
var chatDisplayMode = "type";
var prefixYoutube = 'http://www.youtube.com/watch?v=';
var prefixDailymotion = 'http://www.dailymotion.com/video/';
var chatFilter = []; // User names
var disconnected = false;
var showChatImages = true;
var showChatVideos = true;
var userPopupId = -1;

// Command types
var WHISPER_CMD = 0;

google.load("swfobject", "2.1");

// Message for server disconnection
socket.on('disconnect', function () 
{
    serverMsg("Server disconnected!", 99999, 99999);
});


// Message for setting my player's time to the masterUser's time
socket.on('playerTimeSync', function (time, masterUser) 
{
    // Don't sync if I am the masterUser
    if (myName != masterUser)
    {
        //var timeDiv = document.getElementById("masterTime");
        //timeDiv.innerHTML = time;
        
        // Sync only if I'm faster/slower than masterUser by X seconds
        if (timeDiff > 0 && Math.abs(time - videoPlayer.getCurrentTime()) > timeDiff)
        {
            // Sync only if I'm not paused and I'm playing master's video
            if (videoPlayer.getPlayerState() != 2 && currentVideo == serverVideo)
            {
                if (APImode == "yt")
                {
                    videoPlayer.seekTo(time, true);
                }
                else if (APImode == "dm")
                {
                    videoPlayer.seekTo(time);
                }
            }
        }
    }
});

// Message for updating the list of users in room
socket.on('userListSync', function (users) 
{
    userList = users;
    var userListDiv = document.getElementById("userList");
    $('#userList').html('');
    
    for (var i = 0; i < userList.length; i++)
    {
        $user = $('<SPAN>').attr({class: "user-list-user clickable", id:"user" + i});
        
        var namePart, tripPart;
        
        var tripFound = userList[i].name.match(/!/g);
        if (tripFound)
        {
            var splitName = userList[i].name.split("!");
            namePart = splitName[0];
            tripPart = "!" + splitName[1];
        }
        
        $makeMaster = $('<SPAN>').attr({class: "make-master-user clickable icon-flag icon-large", id: userList[i].name, title: "Give master"});
        
        $user.append("<SPAN Class = 'master-display icon-star-empty icon-large' Title = 'Master User'></SPAN> ");
        
        $user.append("<SPAN Class = 'admin-display icon-heart icon-large' Title = 'This user is an administrator.'></SPAN>");

        if (tripFound && namePart && tripPart)
        {
            $user.append("<SPAN Class = 'name-display'>" + namePart + "<SPAN Class = 'trip-display greentext'>" + tripPart + "</SPAN></SPAN>");
        }
        else
        {
            $user.append("<SPAN Class = 'name-display'>" + userList[i].name + "</SPAN> ");
        }

        if (myName != userList[i].name && !userList[i].adminFlag)
        {
           $user.append($makeMaster);
        }
        
        $user.append("<BR>");
        
        $user.click(function ()
        {
            var userPopupIdString = this.id.replace('user', '');
            userPopupId = parseInt(userPopupIdString);
            
            var name = $(this).find('.name-display').html();
            $('#userPopupName').html(name);
            
            if (name == myName)
            {
                $('.pm-button').hide();
            }
            else
            {
                $('.pm-button').show();
            }
            
            userSettingsCheck();
            
            openPopup($(this).offset().left + 20, $(this).offset().top, '#userPopup');
        });
        
        $('#userList').append($user);
    }
    
    if (myName != masterUser)
    {
        $('.make-master-user').hide();   
    }
    
    $('.make-master-user').click(function() {
        masterUserPassOff(this.id);
    });
     
    setMasterDisplay();
    checkSettings();
    
    // Update number
    $('#totalUsers').html(userList.length);
});

// Message for setting my name
socket.on('nameSync', function (username, superuser)
{
    myName = username;

    var splitName = username.split("!");
    var namePart = splitName[0];
    var tripPart = "!" + splitName[1];
    
    var nameDiv = document.getElementById("username");
    
    if (splitName[1])
    {
        nameDiv.innerHTML = '<SPAN Class = "name-display">' + namePart + '</SPAN>'  +  '<SPAN Class = "trip-display greentext">' + tripPart + '</SPAN>';
    }
    else
    {
        nameDiv.innerHTML = myName;
    }
   
    superUser = superuser;
    displayMasterControls(superUser);

    checkSettings();
});

// Message for setting who the masterUser is
socket.on('masterUserSync', function (user)
{
    masterUser = user;
    //var masterUserDiv = document.getElementById("masteruser");
    //masterUserDiv.innerHTML = masterUser;
    
    if (myName == masterUser || superUser)
    {
        displayMasterControls(true);
    }
    else
    {
        displayMasterControls(false);
    }
    
    // Show in chat
    setMasterDisplay();
});

// Message for generic server message
socket.on('serverMsg', function (msg)
{
    serverMsg(msg, serverMsgFadeDelay, serverMsgFadeTime);
});

// Message for updating chat
socket.on('chatSync', function (chatLine)
{
    var name = chatLine.username;
    
    var userId = userIdByName(name);
    if (userId > -1 && userList[userId].muted)
    {
        return;
    }
    
    var text = chatLine.text;
    
    var whisper = '';
    var whisperTarget = '';
    if (chatLine.whisper)
    {
        whisper = 'whisper';
        if (name == myName && chatLine.whisperTarget)
        {
            whisperTarget = ' [To ' + chatLine.whisperTarget + ']';
        }
    }
    
    var time = chatLine.timestamp;
    timeStr = timestamp(time, "long");
    timeStrShort = timestamp (time, "short");
    
    var namePart, tripPart;
        
    var tripFound = name.match(/!/g);
    if (tripFound)
    {
        var splitName = name.split("!");
        namePart = splitName[0];
        tripPart = "!" + splitName[1];
    }
    
    var tinypicImage = text.match(/(http:\/\/.*.tinypic.com\/.*(.jpg|.gif|.png))/);
    if (tinypicImage && showChatImages)
    {
        text = text.replace(tinypicImage[0], "<IMG Class = \"tinypic-img\" Width = \"" + chatImgWidth + "\" Src = \"" + tinypicImage[0] + "\">");
    }
    
    var tinypicVideo = text.match(/http:\/\/tinypic.com\/r\/(.*)\/(\d*)/);
    if (tinypicVideo && showChatVideos)
    {
        text = text.replace(tinypicVideo[0], "<embed class = \"tinypic-vid\" width=\"" + chatVidWidth + "\" height=\"" + chatVidHeight + "\" type=\"application/x-shockwave-flash\" src=\"http://v5.tinypic.com/player.swf?file=" + tinypicVideo[1] + "&s=" + tinypicVideo[2] + ">");
    }
    
    if (tripFound && namePart && tripPart)
    {
        $('#chatList').append('<DIV Class = \"chat-line ' + whisper + '\" Title = \"' + timeStr + '\"><SPAN Class = \"chat-name\">' + namePart + '<SPAN Class = "trip-display greentext">' + tripPart + whisperTarget + '</SPAN><SPAN Class = \"chat-time\"> (' + timeStrShort + ')</SPAN>:</SPAN> <SPAN Class = \"chat-text\">' + text + '</SPAN></DIV>');
    }
    else
    {
        $('#chatList').append('<DIV Class = \"chat-line ' + whisper + '\" Title = \"' + timeStr + '\"><SPAN Class = \"chat-name\">' + name + whisperTarget + '<SPAN Class = \"chat-time\"> (' + timeStrShort + ')</SPAN>:</SPAN> <SPAN Class = \"chat-text\">' + text + '</SPAN></DIV>');
    }
    
    checkSettings();
    
    var greentext = text.match(/^&gt;.*/);
    if (greentext)
    {
        //text = '<SPAN Class = "greentext">' + text + '</SPAN>';
        text = text.replace(/&gt;/g, ">");
        $('#chatList span').last().addClass('greentext');
    }
    
    
    var picHeight = $('.tinypic-img').last().height();
    if (!picHeight)
    {
        picHeight = 0;
    }
    
    var vidHeight = $('.tinypic-vid').last().height();
    if (!tinypicVideo)
    {
        vidHeight = 0;
    }
    
    var textHeight = $('#chatList span').last().height() + 16;
    if (tinypicImage || tinypicVideo)
    {
        textHeight = 0;
    }
    
    // Keep scrolled at bottom only if bar is already at bottom
    if ($('#chatList')[0].scrollHeight - $('#chatList').scrollTop() <= $('#chatList').outerHeight() + textHeight + picHeight + vidHeight)
    {
        $('#chatList').animate({ scrollTop: $(document).height() * 3 }, 'slow');
    }
    
    if (!tinypicImage && !tinypicVideo)
    {
        if (chatDisplayMode == "fade")
        {
            $('.chat-line').last().hide().fadeIn();
        }
        else if (chatDisplayMode == "type")
        {
            $line = $('#chatList span').last().filter('.chat-text');
            $line.html('');
            typewrite($line, text, 0);
        }
    }
    
    // Add to NND overlay, if enabled
    if (tinypicVideo || $('#NNDOverlay').is(':hidden') || !showChatImages)
    {
        // Do not display videos
        return;
    }
    
    NNDCommentCount += 1;
    var $newNNDText = $('<SPAN>').attr({ class: "NNDComment text-outline", id: NNDCommentCount });
    
    if (chatLine.whisper)
    {
        $newNNDText.addClass('whisper');
    }
    
    $newNNDText.append(text);
    $newNNDText.wrapInner('<b>');
    
    if (name == myName)
    {
        $newNNDText.addClass("nnd-user-msg");
    }
    
    if (tinypicImage)
    {
        // Add images, but make them transparent
        $newNNDText.css({opacity: 0.5});
    
        if (NNDInputCursor < playerHeight - picHeight)
        {
            NNDInputCursor += picHeight;   
        }
        else
        {
            NNDInputCursor = 0;
        }
    }
    else if (!tinypicVideo)
    {
        if (NNDInputCursor < playerHeight - NNDHeight)
        {
            NNDInputCursor += NNDHeight;   
        }
        else
        {
            NNDInputCursor = 0;
        }
    }
    
    // Start at right and move left
    $newNNDText.css({left: playerWidth, top: NNDInputCursor});
    
    $('#NNDOverlay').append($newNNDText);
    
    var size = getInnerWidth('.NNDComment#'+NNDCommentCount);
    $newNNDText.animate({left: -size*2}, 8000, 'linear', function () 
    {
        $newNNDText.remove();
    });
    
    
});

// Message for updating videoList
socket.on('videoListSync', function (videoList)
{
    var id, title, duration, addedBy;
    
    videoPlaylist = [];
    
    for (var i = 0; i < videoList.length; i++)
    {
        id          = htmlEscape(videoList[i].id);
        title       = htmlEscape(videoList[i].title);
        duration    = htmlEscape(videoList[i].duration);
        source      = htmlEscape(videoList[i].source);
        addedBy     = htmlEscape(videoList[i].addedBy);

        videoPlaylist.push({id: id, title: title, duration: duration, addedBy: addedBy, source: source});
    }
    
    buildPlaylist();
});

// Message for syncing just video id from server
socket.on('videoSync', function (videoId, source)
{   
    if (currentVideo == "")
    {        
        // Get initial player size from css container
        playerWidth = parseInt($('#videoDivContainer').css('width'));
        playerHeight = parseInt($('#videoDivContainer').css('height'));
        $('#NNDOverlay').css({width: playerWidth, height: playerHeight});
    }
    
    currentVideo = videoId;
    
    if (source != APImode)
    {

        loadPlayerAPI(source, currentVideo);
    }
    
    setPlayingIndicator();
});

// Message for deleting a video from the playlist
socket.on('deleteVideoSync', function (index)
{
    videoPlaylist.splice(index, 1);
    $('.video-item#' + index).remove();
    
    // Fix ids and display numbers
    var ind = parseInt(index) + 1;
    for (var i = ind; i < videoPlaylist.length + 1; i++)
    {
        var newId = parseInt(i);
        $('.video-item#' + i).find('.video-number').html(newId + '.');
        $('.video-item#' + i).attr({id: newId - 1});
    }
    
    updatePlayTime();
});

// Message for adding a video to the playlist
socket.on('addVideoSync', function (videoObj)
{
    videoPlaylist.push(videoObj);
    $('.video-list').append(generatePlaylistItem(videoPlaylist.length - 1));
    updatePlayTime();
});

// Message for swapping videos on the playlist
socket.on('swapVideoSync', function (index1, index2)
{   
    arraySwap(videoPlaylist, index1, index2);
    $('.video-item#' + index1).replaceWith(generatePlaylistItem(index1));
    $('.video-item#' + index2).replaceWith(generatePlaylistItem(index2));
    setPlayingIndicator();
});


// Message for changing to specific video from master
socket.on('videoChangeSync', function (videoId)
{
    changeVideo(videoId);
});

// Message for enabling/disabling skip button
socket.on('skipEnabledSync', function (enabled)
{
    if (enabled)
    {
        $('#skipButton').removeAttr('disabled');
    } 
    else 
    {
        $('#skipButton').attr('disabled', true);
    }
});

// Message for changing playlist lock icon
socket.on('lockPlaylistSync', function (locked)
{
    if (locked)
    {
        $('#lockPlaylistButton').removeClass("icon-unlock").addClass("icon-lock");
    } 
    else 
    {
        $('#lockPlaylistButton').removeClass("icon-lock").addClass("icon-unlock");
    }
});


// Message for getting current log of chat when first entering room
socket.on('chatLogSync', function (chatLog)
{
    var chatListDiv = document.getElementById("chatList");
    var str = "";
    var time;
    
    for (var i = 0; i < chatLog.length; i++)
    {
        var namePart, tripPart;
        
        var tripFound = chatLog[i].username.match(/!/g);
        if (tripFound)
        {
            var splitName = chatLog[i].username.split("!");
            namePart = splitName[0];
            tripPart = "!" + splitName[1];
        }
    
        time = chatLog[i].timestamp;
        var greentext = chatLog[i].text.match(/^&gt;.*/);
        if (greentext)
        {
            chatLog[i].text = '<SPAN Class = "greentext">' + chatLog[i].text + '</SPAN>';
        }
        
        var tinypicImage = chatLog[i].text.match(/(http:\/\/.*.tinypic.com\/.*(.jpg|.gif|.png))/);
        if (tinypicImage)
        {
            chatLog[i].text = chatLog[i].text.replace(tinypicImage[0], "<IMG Class = \"tinypic-img\" Width = \"" + chatImgWidth + "\" Src = \"" + tinypicImage[0] + "\">");
        }
        
        var tinypicVideo = chatLog[i].text.match(/http:\/\/tinypic.com\/r\/(.*)\/(\d*)/);
        if (tinypicVideo)
        {
            chatLog[i].text = chatLog[i].text.replace(tinypicVideo[0], "<embed class = \"tinypic-vid\" width=\"" + chatVidWidth + "\" height=\"" + chatVidHeight + "\" type=\"application/x-shockwave-flash\" src=\"http://v5.tinypic.com/player.swf?file=" + tinypicVideo[1] + "&s=" + tinypicVideo[2] + "><SPAN Class = \"hide-vid\">[Hide]</SPAN>");
        }
        
        var timeStr = timestamp(time, "long");
        var timeStrShort = timestamp (time, "short");
        
        if (tripFound && namePart && tripPart)
        {
            str += '<DIV Class = \"chat-line\" Title = \"' + timeStr + '\"><SPAN Class = \"chat-name\">' + namePart + '<SPAN Class = "trip-display greentext">' + tripPart + '</SPAN><SPAN Class = \"chat-time\"> (' + timeStrShort + ')</SPAN>:</SPAN> <SPAN Class = \"chat-text\">' + chatLog[i].text + '</SPAN></DIV>';
        }
        else
        {
            str += '<DIV Class = \"chat-line\" Title = \"' + timeStr + '\"><SPAN Class = \"chat-name\">' + chatLog[i].username + '<SPAN Class = \"chat-time\"> (' + timeStrShort + ')</SPAN>:</SPAN> <SPAN Class = \"chat-text\">' + chatLog[i].text + '</SPAN></DIV>';
        }
    }
    chatListDiv.innerHTML = str;
    
    checkSettings();
});

// Message for updating view of number of skips on current video
socket.on('skipSync', function (skips, maxSkips)
{
    var str = skips + '/' + maxSkips;
    $('#skipVote').html(str); 
    
    if (skips == 0)
    {
        // Skips were reset
        $('#skipButton').val('SKIP');
    }
});

// Message for getting current log of chat when first entering room
socket.on('masterVideoPause', function (paused)
{
    if (paused)
    {
        videoPlayer.pauseVideo();
    }
    else
    {
        videoPlayer.playVideo();
    }
});

// Page finished loading
$(function () 
{    
    // Attempt to load saved settings
    loadSettings();
    
    // Make iframes draggable
    $('#iframePopup, #saveVidPopup, #loadVidPopup, #settingsPopup, #roomSettingsPopup, #userPopup').draggable().mousedown(function ()
    {
        // Bring window to front if not already
        if (!$(this).is(':last-child'))
        {
            $(this).parent().append($(this));
        }
    });
    
    //$('#a-div').parent().append($('#a-div'));
    
    $('#iframePopup').append($('#tinypic_plugin_'+id));
    
    $('#closeSettings, #closeRoomSettings, #closeSaveVid, #closeLoadVid, #closeIframe, #closeUserPopup').click(function ()
    {
        $(this).parent().fadeOut(300, function () {
            $(this).hide();
        });
    });

    // Setup settings
    $('#settingShowChatImages, #settingShowChatVideos, #settingNNDToggle, #settingDisplayTrips, #settingShowTimestamp, #settingAllowSkips, #settingPlayerSizeSm, #settingPlayerSizeLg, #settingChatImgSizeSm, #settingChatImgSizeMed, #settingChatImgSizeLg, #settingLockPlaylist, #settingShowChat').click(function ()
    {
        checkSettings();
    });

    
    // Scroll chat to bottom
    $('#chatList').animate({ scrollTop: $(document).height() * 10 }, 'slow');
    
    // Make thumbnail popup follow mouse    
    $(document).mousemove(function(e){
        $('#thumbnailPopup').offset({left:e.pageX-160,top:e.pageY+20});    
    });
               
    // Make a slider for time diff
    /*var slider = $("<div id='timeDiffSlider' style = 'width: 100'></div>").insertAfter(timeDiffSelect).slider(
    {
        min: 1,
        max: timeDiffSelect.children('option').length,
        range: "min",
        value: timeDiffSelect[0].selectedIndex + 1,
        slide: function (event, ui) 
        {
            timeDiffSelect[0].selectedIndex = ui.value - 1;
        }
    });
    
    slider.slider("value", 2);
    */
    var timeDiffSelect = $('#syncTimeDiff');
    timeDiffSelect.change(function () 
    {
        //slider.slider("value", this.selectedIndex + 1);
        switch (this.selectedIndex)
        {
        case 0:
            timeDiff = 2;
            break;
        case 1:
            timeDiff = 5;
            break;
        case 2:
            timeDiff = 10;
            break;
        case 3:
            timeDiff = 20;
            break;
        case 4:
            timeDiff = 0;
            break;
        default:
            timeDiff = 5;
        }
    });
    
    // Text display type
    var textDisplayType = $('#chatTextDisplay');
    textDisplayType.change(function () 
    {
        //slider.slider("value", this.selectedIndex + 1);
        switch (this.selectedIndex)
        {
        case 0:
            chatDisplayMode = "normal";
            break;
        case 1:
            chatDisplayMode = "type";
            break;
        case 2:
            chatDisplayMode = "fade";
            break;
        default:
            chatDisplayMode = "type";
        }
    });

    // Keypress ENTER event for chat input
    $('#chatInput').keypress(function (e) 
    {
        if (e.which == 13) // Enter key
        {
            var message = $('#chatInput').val();
            var whisper = false; 
            var whisperTarget = ""; // A username
            
            if (message.length > 0)
            {
                socket.emit('chatSync', message);
                $('#chatInput').val('');
            }
        }
    });
    
    // Keypress ENTER event for name change input
    $('#changeNameInput').keypress(function (e) 
    {
        if (e.which == 13) 
        {
            var message = $('#changeNameInput').val();
            
            if (message.length > 0)
            {
                socket.emit('requestNameChange', message);
                $('#changeNameInput').val('');
            }
        }
    });
    
    // Keypress ENTER event for add video input
    $('#addVideoInput').keypress(function (e) 
    {
        if (e.which == 13) 
        {
            var message = $('#addVideoInput').val();
            
            if (message.length > 0)
            {
                socket.emit('addVideo', message);
                $('#addVideoInput').val('');
            }
        }
    });
});

// Event listener for when video changes state
function onPlayerStateChange(state)
{
    if (myName == masterUser && state >= 0 && state <= 2)
    {
        // Pass to server
        socket.emit('playerStateChange', state);
    }
    
    if (state == 0)
    {
        nextVideo();
    }
}

// Event listener for when video produces an error
function onPlayerError(error)
{
    // Doesn't matter what error, just request the next video
    if (myName == masterUser || superUser)
    {
    
    }
}

// Callback when YouTube player is ready
function onYouTubePlayerReady(playerId) 
{
    videoPlayer = document.getElementById("videoPlayer");
    //videoPlayer.playVideo();
    
    // Register notifications
    videoPlayer.addEventListener('onStateChange', 'onPlayerStateChange');
    videoPlayer.addEventListener('onError', 'onPlayerError');

    sendTimeSync();
    
    if (videoPlaylist.length > 0)
    {
        var index = indexById(currentVideo);
        document.getElementById("videoTitle").innerHTML = videoPlaylist[index].title;
    }
    
}

function onDailymotionPlayerReady(playerid)
{
    videoPlayer = document.getElementById("videoPlayer");
    //videoPlayer.playVideo();
    
    // Register notifications
    videoPlayer.addEventListener('onStateChange', 'onPlayerStateChange');
    videoPlayer.addEventListener('onError', 'onPlayerError');
    
    sendTimeSync();
    
    if (videoPlaylist.length > 0)
    {
        var index = indexById(currentVideo);
        document.getElementById("videoTitle").innerHTML = videoPlaylist[index].title;
    }
    
}

// Send my player's current time if I'm the masterUser
function sendTimeSync() 
{
    // Validation is server-side and will ignore messages from impostors
    if (myName == masterUser || superUser)
    {
        socket.emit('masterTimeSync', videoPlayer.getCurrentTime());
    }
    setTimeout(sendTimeSync, 2000);
}

// Send playlist swap request
function serverSwapVideo(index1, index2)
{
    if (myName == masterUser || superUser)
    {
        socket.emit('videoListSwap', index1, index2);
    }
}

// Tell server to tell everyone to change to my video
function serverChangeVideo(index)
{
    var vidId = videoPlaylist[index].id;
    var vidSrc = videoPlaylist[index].source;
    if (myName == masterUser && currentVideo != vidId)
    {    
        socket.emit('masterVideoSync', vidId);
    }
    
    if (currentVideo == "")
    {
        loadPlayerAPI(vidSrc, vidId);
    }
}

// Change to specific video
function changeVideo(videoId)
{
    var index = indexById(videoId);
    var source = videoPlaylist[index].source;
    
    // Switch player API, if necessary
    if (source != APImode)
    {
        loadPlayerAPI(source, videoId);    
    }
    else
    {
        videoPlayer.loadVideoById(videoId);
    }
    
    currentVideo = videoId;
    
    document.getElementById("videoTitle").innerHTML = videoPlaylist[index].title;
    
    // Set indicator for currently playing video
    setPlayingIndicator();
}

// Go to next video in playlist
function nextVideo()
{
    var currentVidIndex = indexById(currentVideo);
    
    if (currentVidIndex == videoPlaylist.length - 1)
    {
        currentVidIndex = 0;
    }
    else
    {
        currentVidIndex += 1;
    }
    
    var nextVidId = videoPlaylist[currentVidIndex].id;
    currentVideo = nextVidId;
    
    var source = videoPlaylist[currentVidIndex].source;
    
    // Switch player API, if necessary
    if (source != APImode)
    {
        loadPlayerAPI(source, currentVideo);    
    }
    else
    {
        videoPlayer.loadVideoById(currentVideo);
    }
    
    document.getElementById("videoTitle").innerHTML = videoPlaylist[currentVidIndex].title;
   
    if (myName == masterUser || superUser)
    {
        socket.emit('masterVideoIdSync', currentVideo);
    }
   
    setPlayingIndicator();
}

// Send video deletion request
function sendDeleteSync(videoIndex) 
{
    // Validation is server-side and will ignore messages from impostors
    if (myName == masterUser || superUser)
    {
        socket.emit('deleteVideo', videoIndex);
    }
    setTimeout(sendTimeSync, 2000);
}

// Covnert seconds to a time string
function secondsToTime(seconds)
{
    var days = parseInt(seconds / 86400) % 7;
    var hours = parseInt(seconds / 3600) % 24;
    var minutes = parseInt(seconds / 60) % 60;
    var sec = seconds % 60;

    var result = (days > 0 ? days + "d " : " ") + (hours < 10 ? "0" + hours : hours) + ":" + (minutes < 10 ? "0" + minutes : minutes) + ":" + (sec  < 10 ? "0" + sec : sec);
    return result;
}

// Formats a date string. Expects a UTC date and will convert to local automatically.
function timestamp(date, type)
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
    
    var str = "";
    
    if (type == "long")
    {
        str = month + "/" + day + "/" + year + " " + hours + ":" + minutes + ":" + seconds + " " + suffix;
    }
    else if (type == "short")
    {
        str = hours + ":" + minutes + ":" + seconds + " " + suffix;
    }
    
    return str;
}

// Get index of video by id
function indexById(videoId)
{
    for (var i = 0; i < videoPlaylist.length; i++)
    {
        if (videoId == videoPlaylist[i].id)
        {
            return i;
        }
    }
    return -1;
}

// Change CSS
function updateStyleSheet(filename) 
{ 
    var newstylesheet = "style_" + filename + ".css";
    if ($("#dynamic_css").length == 0) 
    {
        $("head").append("<link>");
        var css = $("head").children(":last");
        css.attr(
        {
            id: "dynamic_css",
            rel:  "stylesheet",
            type: "text/css",
            href: newstylesheet
        });
    } 
    else 
    {
        $("#dynamic_css").attr("href", newstylesheet);
    }
 
}

// Escape html
function htmlEscape(str) 
{
    return str.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}


// Swap elements in an array by index
function arraySwap(arr, index1, index2)
{
    var b = arr[index1];
    arr[index1] = arr[index2];
    arr[index2] = b;
}

// Displays a server message that fades after a bit
function serverMsg(msg, fadeDelay, fadeTime)
{
    $newDiv = $('<DIV>', {html: msg + ' ', class: 'server-msg'});
    $('#serverMessages').prepend($newDiv);
    $newDiv.hide().fadeIn("fast");
    $newDiv.delay(fadeDelay).fadeOut(fadeTime, function() { $(this).remove(); });
}

// Toggles master controls
function displayMasterControls(showControls)
{
    if (showControls)
    {
        $('.sortable').sortable({ disabled: false });
        $('.delete-button').show();
        $('.play-button').show();
        $('.dragger').show();
        $('.make-master-user').show();
        $('.master-control').show();
    }
    else
    {
        $('.sortable').sortable({ disabled: true });
        $('.delete-button').hide();
        $('.play-button').hide();
        $('.dragger').hide(); 
        $('.make-master-user').hide();
        $('.master-control').hide();
    }
}

// Tells server to change master user
function masterUserPassOff(user)
{
    if (myName == masterUser || superUser)
    {
        socket.emit('masterUserPassOff', user);
    }
}

// Set indicator for currently playing video
function setPlayingIndicator()
{
    $('.playing-indicator').hide();
    var curVidIndex = indexById(currentVideo);
    if (curVidIndex > -1)
    {
        var indic = document.getElementsByClassName("playing-indicator")[curVidIndex];
        if (indic)
        {
            indic.style.display = "";
            $indicator = $(indic);
            
            // Set scroll action to scroll to currently playing vid
            var scrollto = $indicator.offset().top - $('#videoList').offset().top + $('#videoList').scrollTop() - ($('#videoList').height() / 2);
            
            $('#goToIndicator').click(function () {
                $('#videoList').animate({ scrollTop: scrollto }, 'slow');
            });
            
            if (firstScroll)
            {
                firstScroll = false;
                $('#goToIndicator').click();
            }
        }
    }
}

// Generates a serialized string of the current playlist that can be
// saved to a text file and loaded later
function generatePlaylistSaveData()
{
    var str = "";
    for (var i = 0; i < videoPlaylist.length; i++)
    {
        if (videoPlaylist[i].source == "yt")
        {
            str += prefixYoutube;
        }
        else
        {
            str += prefixDailymotion;
        }
        
        str += videoPlaylist[i].id + ", " + videoPlaylist[i].title + "\n";
    }
    
    $('#playlistSave').val(str);
    
    // Show popup
    var buttonLeft = $('#playlistSaveButton').offset().left;
    var buttonTop = $('#playlistSaveButton').offset().top;
    var winWidth = $('#saveVidPopup').width() / 2;

    openPopup(buttonLeft-winWidth, buttonTop+50, '#saveVidPopup');
}

function openLoadPopup()
{
    var buttonLeft = $('#playlistLoadButton').offset().left;
    var buttonTop = $('#playlistLoadButton').offset().top;
    var winWidth = $('#loadVidPopup').width() / 2;
    
    openPopup(buttonLeft-winWidth, buttonTop+50, '#loadVidPopup');
}

// Send saved playlist to server
function sendPlaylistSaveData()
{
    var playlistSrc = $('#playlistLoad').val();
    if (myName == masterUser && $('#playlistLoad').val())
    {
        var urls = playlistSrc.match(/(\?v=([a-zA-Z0-9_-]{11}))|(video\/([^\W|_]+))/g);
        
        if (!urls)
        {
            alert("No YouTube or DailyMotion URLs were detected in textbox!");
            return;
        }
        else
        {
            socket.emit('loadPlaylist', playlistSrc);
            $('#closeLoadVid').click();
        }
    }
}

// Show settings
function showSettings()
{
    // Show popup
    var buttonLeft = $('#settingsButton').offset().left;
    var buttonTop = $('#settingsButton').offset().top;
    var winWidth = $('#settingsPopup').width() / 2;
        
    openPopup(buttonLeft-winWidth, buttonTop+50, '#settingsPopup');
}

// Show room settings
function showRoomSettings()
{
    // Show popup
    var buttonLeft = $('#roomSettingsButton').offset().left;
    var buttonTop = $('#roomSettingsButton').offset().top;
    var winWidth = $('#roomSettingsPopup').width() / 2;
        
    openPopup(buttonLeft-winWidth, buttonTop+50, '#roomSettingsPopup');
}

// Clears the playlist 
function clearPlaylist()
{
    if (confirm("Are you sure you want to clear the playlist? (Cannot undo unless you saved it beforehand)") && myName == masterUser)
    {
        socket.emit('clearVideoList');
    }
}


// Cleans the playlist 
function cleanPlaylist()
{
    if (confirm("Are you sure you want to clean the playlist? (Cannot undo)") && myName == masterUser)
    {
        socket.emit('cleanVideoList');
    }
}

// Shuffle the playlist
function shufflePlaylist()
{
    if (myName == masterUser || superUser)
    {
        socket.emit('shuffleVideoList');
    }
}

function toggleSkip()
{
    if ($('#skipButton').val() == 'SKIP')
    {
        $('#skipButton').val('UNSKIP');
    }
    else
    {
        $('#skipButton').val('SKIP');
    }
    socket.emit('toggleSkip');
}

function toggleSkipEnabled(enabled)
{
    if (myName == masterUser || superUser)
    {
        socket.emit('toggleSkippingEnabled', enabled);
    }
}

function togglePlaylistLocked(locked)
{
    if (myName == masterUser || superUser)
    {
        socket.emit('togglePlaylistLocked', locked);
    }
}

// Load new player API
function loadPlayerAPI(newSource, videoId)
{
    swfobject.removeSWF("videoPlayer");
    $('#videoDiv, #videoPlayer').remove();
    
    // Need to make new videoDiv
    $videoDiv = $('<DIV>').attr({id: "videoDiv"});
    
    // Insert after title div
    $videoDiv.insertAfter($('#videoTitle'));
 
    if (newSource == "yt")
    {
        var params = { allowScriptAccess: "always", allowFullScreen: "true", wmode: "opaque", scale: "exactFit" };
        var atts = { id: "videoPlayer" };
        swfobject.embedSWF("http://www.youtube.com/v/" + videoId + "?version=3&enablejsapi=1&playerapiid=player1&autohide=1&autoplay=1", "videoDiv", "100%", "100%", "9", null, null, params, atts);
        
    }
    else if (newSource == "dm")
    {
        var params = { allowScriptAccess: "always", allowFullScreen: "true", wmode: "opaque", scale: "exactFit" };
        var atts = { id: "videoPlayer" };
        swfobject.embedSWF("http://www.dailymotion.com/swf/" + videoId + "&enableApi=1&playerapiid=videoPlayer&autoplay=1&logo=0",
                       "videoDiv", "100%", "100%", "9", null, null, params, atts);
    }
    else if (newSource == "us")
    {
        var embed = "<iframe id = \"videoPlayer\" width=\"100%\" height=\"100%\" src=\"http://www.ustream.tv/embed/" + videoId + "?v=3&wmode=transparent&autoplay=true\" scrolling=\"no\" frameborder=\"0\" style=\"border: 0px none transparent;\"></iframe>";
        
        // Change title
        $('#videoTitle').html("UStream Live");
        
        $('body').append(embed);
    }
    else if (newSource == "ls")
    {
        var embed = "<iframe id = \"videoPlayer\" width=\"100%\" height=\"100%\" src=\"http://cdn.livestream.com/embed/" + videoId + "?layout=4&wmode=transparent&autoplay=true\" scrolling=\"no\" frameborder=\"0\" style=\"border: 0px none transparent;\"></iframe>";
        
        // Change title
        $('#videoTitle').html("Livestream Live");
        
        $('body').append(embed);
    }
    else if (newSource == "tw")
    {
        var params = { allowScriptAccess: "always", allowFullScreen: "true", wmode: "opaque", scale: "exactFit", allowNetworking: "all", flashvars: "hostname=www.twitch.tv&channel=" + videoId + "&auto_play=true&start_volume=25" };
        var atts = { id: "videoPlayer" };
        swfobject.embedSWF("http://www.twitch.tv/widgets/live_embed_player.swf?channel=" + videoId, "videoDiv", "100%", "100%", "9", null, null, params, atts);
        
        // Change title
        $('#videoTitle').html("Twitch.tv Live");
    }
     
    $('#videoDivContainer').append($('#videoPlayer'));
    APImode = newSource;    
}


// Show who's master or admin user in the user list
function setMasterDisplay()
{
    $('.master-display, .admin-display').hide();

    for (var i = 0; i < userList.length; i++)
    {
        if (userList[i].adminFlag)
        {
            $('.user-list-user#user' + i + ' .admin-display').css("color", "red").show();
            $('.user-list-user#user' + i + ' .name-display').css("color", "red");
        }
        
        if (userList[i].name == masterUser && !userList[i].adminFlag)
        {
            $('.user-list-user#user' + i + ' .master-display').show();
        }
    }
    /*$('.name-display').each(function ()
    {
        var str = $(this).html().replace(/<(?:.|\n)*?>/gm, '');
        if (str == masterUser)
        {
            $(this).prev().show();
        }
    });*/
}


// Convert a local image to upload to server
function sendImage() 
{
    var self = this;

    var reader = new FileReader();
    var file = $('#img-input').prop('files')[0];

    reader.onloadend = function() 
    {
        // Shrink image before sending
        var image = document.createElement('img');
        image.src = reader.result;

        image.onload = function() 
        {
            var maxFilesize = 5000;
            var maxSize = 100;
            var canvas = document.createElement('canvas');
            var ctx = canvas.getContext('2d');
            
            var aspRatio = image.width / image.height;
            canvas.width = maxSize;
            canvas.height = maxSize / aspRatio;
            
            ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
            var shrinked = canvas.toDataURL('image/jpeg', 0.3);
            
            $newimage = $('<IMG>').attr({src: shrinked});
            $('#chatList').append($newimage);

            alert(shrinked.length/1000);
            
        }
    };

    reader.readAsDataURL(file); // Convert image to base64
}

// Shows the Tinypic popup box
function openTinypic()
{
    showTinypicPlugin();
        
    var buttonTop = $('#openTinypicButton').offset().top;
    var buttonLeft = $('#openTinypicButton').offset().left;
    var height = $('#iframePopup').height();
    $('#iframePopup').css({left:buttonLeft+100, top:buttonTop-height}).show("fold", null, 500);
}

// Type out a string character-by-character
function typewrite(element, str, charIdx)
{
    if (charIdx < str.length)
    {
        $(element).append(str.charAt(charIdx));
        charIdx += 1;
        
        var recurse = function() { typewrite(element, str, charIdx); };
        setTimeout(recurse, 30);
    }
    else
    {
        $(element).html(str);
    }
}

// Settings check
function checkSettings()
{   
    if (!document.getElementById('settingDisplayTrips').checked)
    {
        $('.trip-display').hide();
    }
    else
    {
        $('.trip-display').show();
    }
    
    if (!document.getElementById('settingShowChatImages').checked)
    {
        showChatImages = false;
        $('.tinypic-img').hide();
    }
    else
    {
        showChatImages = true;
        $('.tinypic-img').show();
    }
    
    if (!document.getElementById('settingShowChatVideos').checked)
    {
        showChatVideos = false;
        $('.tinypic-vid').hide();
    }
    else
    {
        showChatVideos = true;
        $('.tinypic-vid').show();
    }
    
    if (!document.getElementById('settingNNDToggle').checked)
    {
        $('#NNDOverlay').hide();
    }
    else
    {
        $('#NNDOverlay').show();
    }
    
    if (!document.getElementById('settingShowTimestamp').checked)
    {
        $('.chat-time').hide();
    }
    else
    {
        $('.chat-time').show();
    }
       
    if (!document.getElementById('settingShowChat').checked)
    {
        $('#chatList').hide();
        $('#userList').hide();
    }
    else
    {
        $('#chatList').show();
        $('#userList').show();
    }
        
    if (document.getElementById('settingPlayerSizeSm').checked)
    {
        playerWidth = 640;
        playerHeight = 385;
        $('#videoDivContainer, #NNDOverlay').css("width", playerWidth);
        $('#videoDivContainer, #NNDOverlay').css("height", playerHeight);
        $('#videoDivContainer, #NNDOverlay').css("margin-left", "0");
        $('#videoTitle').css("text-align", "left");        
    }
    else if (document.getElementById('settingPlayerSizeLg').checked)
    {
        var center = parseInt($("#centerer").css("width"), 10)/2;
        playerWidth = 854;
        playerHeight = 480;
        $('#videoDivContainer, #NNDOverlay').css("width", playerWidth);
        $('#videoDivContainer, #NNDOverlay').css("height", playerHeight);
        $('#videoDivContainer, #NNDOverlay').css("margin-left", center - playerWidth/2 - 25);
        $('#videoTitle').css("text-align", "center");
    }
    
    if (document.getElementById('settingChatImgSizeSm').checked)
    {
        chatImgWidth = chatImgWidthSm;
        $('.tinypic-img').width(chatImgWidthSm);
    }
    else if (document.getElementById('settingChatImgSizeMed').checked)
    {
        chatImgWidth = chatImgWidthMed;
        $('.tinypic-img').width(chatImgWidthMed);
    }
    else if (document.getElementById('settingChatImgSizeLg').checked)
    {
        chatImgWidth = chatImgWidthLg;
        $('.tinypic-img').width(chatImgWidthLg);
    }
    
    toggleSkipEnabled(document.getElementById('settingAllowSkips').checked);
    togglePlaylistLocked(document.getElementById('settingLockPlaylist').checked);
}

// Updates skip settings for room
function applySkipSettings()
{
    if (myName == masterUser || superUser)
    {
        var usePercent = document.getElementById('settingSkipByPercent').checked;
        var skipVal = -100;
        
        if (!usePercent)
        {
            skipVal = document.getElementById('skipVotes').value;
            if (skipVal < 0 || skipVal > 999)
            {
                alert("Invalid number of skips, moran.");
                return;
            }
        }
        else
        {
            skipVal = document.getElementById('skipPercent').value;
            if (skipVal < 0 || skipVal > 100)
            {
                alert("Invalid skip percentage, moran");
                return;
            }
        }
        socket.emit('updateSkipSettings', usePercent, skipVal);
    }
}

// Builds/rebuilds the playlist view
function buildPlaylist()
{
    playlistTotalTime = 0;
    document.getElementById("videoList").innerHTML = "";
    document.getElementById("videoListInfo").innerHTML = "";
    
    $newList = $('<UL>').attr({class: "sortable video-list"});

    var $playlistItem;
    for (var i = 0; i < videoPlaylist.length; i++)
    {
        $playlistItem = generatePlaylistItem(i);
        $newList.append($playlistItem);
        playlistTotalTime += parseInt(videoPlaylist[i].duration);
    }
    
    $('#videoList').append($newList);
    
    // Generate playlist info
    $('#videoListInfo').append("Playlist: <SPAN Id = 'playlistTime'>" + secondsToTime(playlistTotalTime) + "</SPAN>, <SPAN Id = 'playlistLength'>" + videoPlaylist.length + "</SPAN> videos");
    
    // Generate playlist controls
    $goToControl = $('<SPAN>').attr({id: "goToIndicator", class: "clickable icon-bullseye icon-large", title: "Scroll to currently playing video"});
    $goToControl.css("padding-left", "8");
    
    $lockPlaylistControl = $('<SPAN>').attr({id: "lockPlaylistButton", class: "clickable icon-unlock icon-large", title: "Playlist locking state"});
    $lockPlaylistControl.css("padding-left", "8");
    
    $('#videoListInfo').append($lockPlaylistControl);
    $('#videoListInfo').append($goToControl);
    
    if (myName == masterUser || superUser)
    {
        $('.sortable').sortable({
            placeholder: "ui-state-highlight",
            handle: ".dragger",
            start: function(event, ui) {
                origIndex = ui.item.index();
            },
            update: function(event, ui) {
                // Tell server to swap the elements
                //alert("Swapping " + ui.item.index() + " and " + origIndex);
                serverSwapVideo(ui.item.index(), origIndex);
                
                // Cancel actually modifying locally
                $('.sortable').sortable('cancel');
            }
        });
    }
    else
    {    
        $('.sortable').sortable({ disabled: true });
    }
    
    $('.sortable').disableSelection();
    
    setPlayingIndicator();
}

// Generates a LI for the videoPlaylist item at the given index
// Returns null if video isn't on playlist
function generatePlaylistItem(index)
{
    if (!videoPlaylist[index])
    {
        return null;
    }
    
    $newListItem = $('<LI>').attr({class: "ui-state-default video-item", id: index});
    
    $dragger = $('<SPAN>').attr({class: "dragger icon-sort icon-large"});
    
    $number = $('<SPAN>').attr({class: "video-number"});
    $number.append(index + 1 + '.');
    
    $playButton = $('<SPAN>').attr({class: "play-button icon-play-circle icon-large clickable", id: "tit" + index, title: "Play this video"});
    
    $urlButton = $('<SPAN>').attr({class: "url-button icon-link icon-large", id: index, title: "Link to video"});
    
    $deleteButton = $('<SPAN>').attr({class: "delete-button icon-remove icon-large", id: index, title: "Double-click to delete"});
    
    $playingIndicator = $('<SPAN>').attr({class: "playing-indicator icon-youtube-play icon-large", id: index});
    
    $vidTitle = $('<SPAN>').attr({class: "video-title"});
    $vidTitle.append(videoPlaylist[index].title);
     
    $vidDuration = $('<SPAN>').attr({class: "video-duration"});
    
    $vidDuration.append(secondsToTime(videoPlaylist[index].duration));
    $vidAddedBy = $('<SPAN>').attr({class: "video-addedBy"});
    $vidAddedBy.append('added by ' + videoPlaylist[index].addedBy);
    
    $newListItem.append($number);
    
    $newListItem.append($vidTitle);
    $newListItem.append($playingIndicator);
    
    $newListItem.append($dragger);
    $newListItem.append($vidAddedBy);
    $newListItem.append($vidDuration);
    
    $newListItem.append($playButton);
    $newListItem.append($urlButton);
    $newListItem.append($deleteButton);
    $playingIndicator.hide();
    
    // Marquee long video titles
    if (getTextWidth(videoPlaylist[index].title) >= $vidTitle.width())
    {
        $marquee = $('<MARQUEE>').attr({behavior: "alternate", scrollDelay: "200", hspace: "10", scrollAmount: "0"});
        
        $marquee.hover(function () 
        {
            this.scrollAmount = 6;
        }, function () 
        {
            this.scrollAmount = 0;
        });
        
        $vidTitle.wrapInner($marquee);
    }
    
    // Setup events
    if (myName == masterUser || superUser)
    {
        $deleteButton.dblclick(function() {
            var id = getIdForVideoItem(this);
            sendDeleteSync(id);
        });
                
        $vidTitle.dblclick(function() {
            var id = getIdForVideoItem(this);
            serverChangeVideo(id);
        });
        
        $playButton.click(function() {
            var id = getIdForVideoItem(this);
            $(this).effect("pulsate", null, 100);
            serverChangeVideo(id);
        });
    }
    else
    {
        // Disable playlist controls
        $dragger.hide();
        $deleteButton.hide();
    }
    
    // Change cursor on hover
    $deleteButton.hover(function() {
        $(this).css('cursor','pointer');
    }, function() {
        $(this).css('cursor','auto');
    });
    
    $urlButton.hover(function() {
        $(this).css('cursor','pointer');
    }, function() {
        $(this).css('cursor','auto');
    });
    
    $dragger.hover(function() {
        $(this).css('cursor','move');
    }, function() {
        $(this).css('cursor','auto');
    });
    
    // Click event for showing video's url
    $urlButton.click(function() {
        var url;
        var vidId = getIdForVideoItem(this);
        var id = videoPlaylist[vidId].id;
        if (source == "yt")
        {
            url = 'http://www.youtube.com/watch?v=' + id;
        }
        else if (source == "dm")
        {
            url = 'http://www.dailymotion.com/video/' + id;
        }
        alert(url);
    });
    
    // Add thumbnail previews on hover
    var hoverTimeout;
    $vidTitle.hover(function(e) {  
        var imgUrl;
        var id = getIdForVideoItem(this);
        
        if (videoPlaylist[id].source == "yt")
        {
            imgUrl = 'http://img.youtube.com/vi/' + videoPlaylist[id].id + '/0.jpg';
        }
        else if (videoPlaylist[id].source == "dm")
        {
            imgUrl = 'http://www.dailymotion.com/thumbnail/video/' + videoPlaylist[id].id;
        }
        
        $(this).css('cursor','pointer');
        $thumbnail = $('<IMG>').attr({class: "thumbnail", src: imgUrl});
        $('#thumbnailPopup').html('');
        $('#thumbnailPopup').append(videoPlaylist[id].title + "<BR>");
        $('#thumbnailPopup').append($thumbnail);
       
        hoverTimeout = setTimeout(function() {
            $('#thumbnailPopup').show().offset({left:e.pageX-160,top:e.pageY+20}).fadeTo(1, 0.8);
        }, 1000);
    }, function() {
        $(this).css('cursor','auto');
        $('#thumbnailPopup').hide();
        clearTimeout(hoverTimeout);
    });
    
    return $newListItem;
}

// Gets id from the LI parent
function getIdForVideoItem(element)
{
    var id = $(element).parents('LI').get(0).id;
    return id;
}

// Get inner width of a span
function getInnerWidth(element)
{
    // ELEMENT MUST HAVE CHILDREN
    var self = $(element);
    var calculator = $('<span style="display: inline-block;">');
    self.wrapInner(calculator);
    var inner = $(element + "> span");
    var width = inner.width();
    inner.children().unwrap();
    return width;
}

// Get the display width of some text
function getTextWidth(text)
{
    var calc = '<span style="display:none">' + text + '</span>';
    $('body').append(calc);
    var width = $('body').find('span:last').width();
    $('body').find('span:last').remove();
    return width;
}

// Save settings to localstorage
function saveSettings()
{
    var settings = {
        "syncTime": $('#syncTimeDiff').selectedIndex,
        "chatTextDisplay": $('#chatTextDisplay').selectedIndex,
        "settingPlayerSizeSm": document.getElementById('settingPlayerSizeSm').checked,
        "settingPlayerSizeLg": document.getElementById('settingPlayerSizeLg').checked,
        "settingChatImgSizeSm": document.getElementById('settingChatImgSizeSm').checked,
        "settingChatImgSizeMed": document.getElementById('settingChatImgSizeMed').checked,
        "settingChatImgSizeLg": document.getElementById('settingChatImgSizeLg').checked,
        "showChatImages": document.getElementById('settingShowChatImages').checked,
        "showChatVideos": document.getElementById('settingShowChatVideos').checked,
        "showNND": document.getElementById('settingNNDToggle').checked,
        "showTimestamp": document.getElementById('settingShowTimestamp').checked,
        "showTrips": document.getElementById('settingDisplayTrips').checked,
        "showChat": document.getElementById('settingShowChat').checked
    };
    
    localStorage.setItem('userSettings', JSON.stringify(settings));
    alert("Saved settings");
}

// Load settings from localstorage, if they exist. Performed on page load.
function loadSettings()
{
    var storedSettings = localStorage.getItem('userSettings');
    if (storedSettings)
    {
        var settings = JSON.parse(storedSettings);
        $('#syncTimeDiff').selectedIndex = settings.syncTime;
        $('#chatTextDisplay').selectedIndex = settings.chatTextDisplay;
        document.getElementById('settingPlayerSizeSm').checked = settings.settingPlayerSizeSm;
        document.getElementById('settingPlayerSizeLg').checked = settings.settingPlayerSizeLg;
        document.getElementById('settingChatImgSizeSm').checked = settings.settingChatImgSizeSm;
        document.getElementById('settingChatImgSizeMed').checked = settings.settingChatImgSizeMed;
        document.getElementById('settingChatImgSizeLg').checked = settings.settingChatImgSizeLg;
        document.getElementById('settingShowChatImages').checked = settings.showChatImages;
        document.getElementById('settingShowChatVideos').checked = settings.showChatVideos;
        document.getElementById('settingNNDToggle').checked = settings.showNND;
        document.getElementById('settingShowTimestamp').checked = settings.showTimestamp;
        document.getElementById('settingDisplayTrips').checked = settings.showTrips;
        document.getElementById('settingShowChat').checked = settings.showChat;
    }
}

// Reset settings to default values/delete settings cookie
function resetSettings()
{
    localStorage.clear();
    alert("Settings have been reset");
}

// Toggle add video input box
function toggleAddVideo()
{
    if ($('#addVideoInput').is(':hidden'))
    {
        $('#addVideoInput').show().css({ width: 0 }).animate({ width: 300 }, 'fast');
    }
    else
    {
        $('#addVideoButton').removeAttr('disabled');        
        $('#loadStreamButton').removeAttr('disabled');
        $('#addVideoInput').css({ width: 300 }).animate({ width: 0 }, 'fast', 'swing', 
        function () {
            $(this).hide();
        });
    }
}

// Opens a popup at position [leftPos, topPos] with id popupId
function openPopup(leftPos, topPos, popupId)
{
    $(popupId).each(function () 
    {
        $(this).parent().append($(this));
        $(this).css({left:leftPos, top:topPos});
        $(this).show("fold", null, 500);
    });
}

// Toggles display of a user's messages
function toggleUserMute()
{
    var username = userList[userPopupId].name;
    
    /*var namePart, tripPart;    
    var tripFound = name.match(/!/g);
    if (tripFound)
    {
        var splitName = name.split("!");
        namePart = splitName[0];
        tripPart = "!" + splitName[1];
    }*/

    var index = chatFilter.indexOf(username);
    if (index == -1)
    {
        // Add to filter list
        chatFilter.push(username);
        userList[userPopupId].muted = true;
        $(".chat-line:contains('" + username + "')").hide("fade", null, 100);  
    }
    else
    {
        // Remove from filter list
        chatFilter.splice(index, 1);
        userList[userPopupId].muted = false;
        $(".chat-line:contains('" + username + "')").show("fade", null, 100);
    }
    
    userSettingsCheck();
}

function setPrivateMessage()
{
    var username = userList[userPopupId].name;
    var str = '/w ' + username + ' ';
    $('#closeUserPopup').click();
    $('#chatInput').focus().val(str);
}


// Sets the views user popup settings
function userSettingsCheck()
{
    if (userList[userPopupId].muted)
    {
        $('.mute-button').removeClass('icon-volume-up').addClass('icon-volume-off');
    }
    else
    {
        $('.mute-button').removeClass('icon-volume-off').addClass('icon-volume-up');
    }
}

// Get id/index of a user by username
function userIdByName(username)
{
    for (var i = 0; i < userList.length; i++)
    {
        if (userList[i].name == username)
        {
            return i;
        }
    }
    
    return -1;
}

// Updates the play time display 
function updatePlayTime()
{
    playlistTotalTime = 0;
    for (var i = 0; i < videoPlaylist.length; i++)
    {
        playlistTotalTime += parseInt(videoPlaylist[i].duration);
    }
    
    $('#playlistTime').html(secondsToTime(playlistTotalTime));
    $('#playlistLength').html(videoPlaylist.length);
}

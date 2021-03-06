var playerWidth = 640;
var playerHeight = 385;
var myName = "";
var masterUser = "";
var guestMasterUser = "";
var superUser = false;
var modUser = false;
var currentVideo = "";
var serverVideo = "";
var socket = io.connect();
var videoPlayer;
var serverMsgFadeDelay = 5000;
var serverMsgFadeTime = 1500;
var videoPlaylist = [];
var playlistTotalTime = 0; // In seconds
var userList = []; // {string name, string trip, USER_TYPE userType, bool muted, bool dead}
var modList = [];
var banList = [];
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
var NNDInputCursor = 0;
var NNDCommentCount = 0;
var chatDisplayMode = "type";
var prefixYoutube = 'http://www.youtube.com/watch?v=';
var prefixDailymotion = 'http://www.dailymotion.com/video/';
var chatFilter = []; // User names
var disconnected = false;
var showChatImages = true;
var showChatVideos = true;
var userPopupId = -1;
var imageEmbedOpacity = 0.5;
var usingChrome = (navigator.userAgent.toLowerCase().indexOf('chrome') > -1);

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

google.load("swfobject", "2.1");

// Page finished loading
$(function () 
{    
    serverMsg("Connecting...", 99999, 99999);

    // Attempt to load saved settings
    loadSettings();
    
    // Make iframes draggable
    $('#iframePopup, #saveVidPopup, #loadVidPopup, #settingsPopup, #roomSettingsPopup, #userPopup, #cpPopup, #banUserPopup').draggable({handle: '.popup-gripper'}).mousedown(function ()
    {
        // Bring window to front if not already
        if (!$(this).is(':last-child'))
        {
            $(this).parent().append($(this));
        }
    });
        
    $('#closeSettings, #closeRoomSettings, #closeSaveVid, #closeLoadVid, #closeIframe, #closeUserPopup, #closeAdminCPSettings, #closeBanUserPopup').click(function ()
    {
        $(this).parent().fadeOut(300, function () {
            $(this).hide();
        });
    });

    // Setup settings -- TODO should be able to clean this
    $('#settingShowChatImages, #settingShowChatVideos, #settingNNDToggle, #settingDisplayTrips, #settingShowTimestamp, #settingAllowSkips, #settingPlayerSizeSm, #settingPlayerSizeLg, #settingChatImgSizeSm, #settingChatImgSizeMed, #settingChatImgSizeLg, #settingLockPlaylist, #settingShowChat, #settingVideoVoting, #settingVideoVoteAutoplay, #settingNormalUserMaster').click(function ()
    {
        checkSettings();
    });

    
    // Scroll chat to bottom
    $('#chatList').animate({ scrollTop: $(document).height() * 10 }, 'slow');
    
    // Make thumbnail popup follow mouse    
    $(document).mousemove(function(e){
        $('#thumbnailPopup').offset({left:e.pageX-180,top:e.pageY-360});    
    });
    
    // Add events for changing user name
    $('#username').click(function ()
    {
        $(this).hide();
        $('#changeNameInput').val($(this).text()).show();
        $('#changeNameClose').show();
    });
    
    $('#changeNameClose').click(function ()
    {
        $(this).hide();
        $('#changeNameInput').hide();
        $('#username').show();
    });
       
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
            
            // Remove excess whitespace
            message = message.replace(/(\s)+/g, "$1");
            
            if (message.length > 0 && message != ' ')
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
                $('#changeNameClose').click();
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
    
    
    /**SOCKET MESSAGES**/
    
    // Message for server connect/reconnect
    socket.on('connect', function ()
    {
        $('#serverMessages').html('');
        serverMsg("Connected!", serverMsgFadeDelay, serverMsgFadeTime);
    });
    
    // Message for server disconnection
    socket.on('disconnect', function () 
    {
        serverMsg("Server disconnected!", 99999, 99999);
    });


    // Message for setting my player's time to the masterUser's time
    socket.on('playerTimeSync', function (time) 
    {
        // Don't sync if I am the masterUser
        if (myName != masterUser || (masterUser != "" && myName != guestMasterUser))
        {
            //var timeDiv = document.getElementById("masterTime");
            //timeDiv.innerHTML = time;
            
            // Sync only if I'm faster/slower than masterUser by X seconds
            if (timeDiff > 0 && Math.abs(time - videoPlayer.getCurrentTime()) > timeDiff)
            {
                // Sync only if I'm not paused and I'm playing master's video
                if (videoPlayer.getPlayerState() != PLAYER_STATE_TYPE.paused && currentVideo == serverVideo)
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
            var $user = $('<SPAN>').attr({class: "user-list-user clickable", id:"user" + i});
            
            var namePart, tripPart;
            
            var tripFound = userList[i].name.match(/!/g);
            if (tripFound)
            {
                var splitName = userList[i].name.split("!");
                namePart = splitName[0];
                tripPart = "!" + splitName[1];
            }
            
            var $makeMaster = $('<SPAN>').attr({class: "make-master-user clickable fa fa-flag-o fa-lg", id: userList[i].name, title: "Give master"});
            
            var $masterDisplay = $('<SPAN>').attr({class: "master-display fa fa-star-o fa-lg", title: "Master User"});
            
            $user.append($masterDisplay);
            
            $user.append("<SPAN Class = 'admin-display fa fa-heart fa-lg' Title = 'This user is an administrator.'></SPAN>");
            
            $user.append("<SPAN Class = 'mod-display fa fa-meh-o fa-lg' Title = 'This user is a moderator.'></SPAN>");

            if (tripFound && namePart && tripPart)
            {
                $user.append("<SPAN Class = 'name-display'>" + namePart + "<SPAN Class = 'trip-display greentext'>" + tripPart + "</SPAN></SPAN>");
            }
            else
            {
                $user.append("<SPAN Class = 'name-display'>" + userList[i].name + "</SPAN> ");
            }

            if (myName != userList[i].name && userList[i].userType != USER_TYPE.admin)
            {
               $user.append($makeMaster);
            }
            
            $user.append("<BR>");
            
            $user.click(function ()
            {
                var userPopupIdString = this.id.replace('user', '');
                userPopupId = parseInt(userPopupIdString);
                
                var name = $(this).find('.name-display').text();
                $('#userPopupName').html(tripColorize(name));
                
                if (name == myName)
                {
                    $('.ban-button').hide();
                    $('.boot-button').hide();
                    $('.mod-button').hide();
                    $('.pm-button').hide();
                }
                else
                {
                    $('.pm-button').show();
                    
                    var id = userIdByName(name);
                    var type = userList[id].userType;
                    
                    if ((superUser || modUser) && type != USER_TYPE.admin && type != USER_TYPE.mod)
                    {
                        $('.ban-button').show();
                        $('.mod-button').show();
                    }
                    
                    if ((masterUser == myName || superUser || modUser) && type != USER_TYPE.admin)
                    {
                         $('.boot-button').show();
                    }
                }
                
                userSettingsCheck();
                
                openPopup($(this).offset().left - 200, $(this).offset().top, '#userPopup');
            });
            
            $masterDisplay.click(function (e) 
            { 
                if (modUser && myName != masterUser)
                {
                    // Steal master
                    masterUserPassOff(myName);
                }
                
                e.stopPropagation();
            });
            
            $makeMaster.click(function (e) 
            { 
                masterUserPassOff(this.id);
                e.stopPropagation(); 
            });
            
            $('#userList').append($user);
        }
        
        if (myName != masterUser)
        {
            $('.make-master-user').hide();   
        }
        
        setMasterDisplay();
        checkSettings();
        
        // Update number
        $('#totalUsers').html(userList.length);
    });

    // Message for setting my name
    socket.on('nameSync', function (username, type)
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
        
        switch (type)
        {
            case USER_TYPE.admin:
                superUser = true;
                break;
            case USER_TYPE.mod:
                modUser = true;
                break;
            default:
                superUser = false;
                modUser = false;
        }
        
        displayMasterControls(superUser);
        checkSettings();
    });

    // Message for setting user type
    socket.on('userTypeSync', function (newType)
    {
        switch (newType)
        {
            case USER_TYPE.admin:
                superUser = true;
                break;
            case USER_TYPE.mod:
                modUser = true;
                break;
            default:
                superUser = false;
                modUser = false;
        }
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

    // Message for setting a guest master user
    socket.on('guestMasterUserSync', function (user)
    {
        guestMasterUser = user;
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
                var $line = $('#chatList span').last().filter('.chat-text');
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
        
        if (greentext)
        {
            text = text.replace(/&gt;/g, ">");
            $newNNDText.addClass('greentext');
        }
        
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
        
        // Check input cursor
        if ((tinypicImage && NNDInputCursor > (playerHeight - picHeight)) || (!tinypicVideo && NNDInputCursor > (playerHeight - NNDHeight)))
        {
            NNDInputCursor = 0;
        }
        
        // Start at right and move left
        $newNNDText.css({left: playerWidth, top: NNDInputCursor});
        
        $('#NNDOverlay').append($newNNDText);
        
        var size = getInnerWidth('.NNDComment#'+NNDCommentCount);
        $newNNDText.animate({left: -size*2}, 8000, 'linear', function () 
        {
            $newNNDText.remove();
        });
        
        // Move input cursor
        if (tinypicImage)
        {
            // Add images, but make them transparent
            $newNNDText.css({opacity: imageEmbedOpacity});
        
            if (NNDInputCursor < (playerHeight - picHeight))
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
            if (NNDInputCursor < (playerHeight - NNDHeight))
            {
                NNDInputCursor += NNDHeight;   
            }
            else
            {
                NNDInputCursor = 0;
            }
        }
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
        changeVideo(videoId, source);
    });

    // Message for deleting a video from the playlist
    socket.on('deleteVideoSync', function (index)
    {
        // Re-enable voting if you voted for deleted video
        if ($('.video-item#' + index + ' .video-vote-button').val() == 'Unvote')
        {
            var curVidIndex = indexById(currentVideo);
            var $curVidVoteButton = $('.video-item#' + curVidIndex + ' .video-vote-button');
            $('.video-item .video-vote-button').not($curVidVoteButton).attr({disabled: false});
        }
    
        videoPlaylist.splice(index, 1);
        
        if (videoPlaylist.length == 0)
        {
            var $emptyPlaylistMsg = $('<DIV>').attr({id: 'noVideosMsg'});
            $emptyPlaylistMsg.html('Playlist is empty! Add some videos!');
            $('#videoList').append($emptyPlaylistMsg);
        }
        
        $('.video-item#' + index).fadeOut('fast', function () 
        {
            $(this).remove();
            
            // Fix ids and display numbers
            $('LI.video-item').each(function(i) 
            {
                $(this).attr({id: parseInt(i)});
                $(this).find('.video-number').html(parseInt(i + 1) + '.');
            });
        });
        
        updatePlayTime();
    });

    // Message for adding a video to the playlist
    socket.on('addVideoSync', function (videoObj)
    {
        $('#noVideosMsg').remove();
        videoPlaylist.push(videoObj);
        
        var $newVideo = generatePlaylistItem(videoPlaylist.length - 1)
        $('.video-list').append($newVideo);
        $newVideo.hide().fadeIn('fast');
        
        updatePlayTime();
    });

    // Message for moving videos on the playlist
    socket.on('moveVideoSync', function (index1, index2)
    {   
        // Save and remove object at index2 and insert at index1
        var savedObj = videoPlaylist.splice(index2, 1);
        if (savedObj[0])
        {
            videoPlaylist.splice(index1, 0, savedObj[0]);
            $('.video-item#' + index2).remove();
            
            if (parseInt(index1) < parseInt(index2))
            {
                $('.video-item#' + index1).before(generatePlaylistItem(index1));
            }
            else
            {
                $('.video-item#' + index1).after(generatePlaylistItem(index1));
            }
            
            $('LI.video-item').each(function(i) 
            {
                $(this).attr({id: parseInt(i)});
                $(this).find('.video-number').html(parseInt(i + 1) + '.');
            });
            
            setPlayingIndicator();
        }
    });


    // Message for changing to specific video from master
    socket.on('videoChangeSync', function (videoId, source)
    {
        changeVideo(videoId, source);
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
            $('#lockPlaylistButton').removeClass("fa fa-unlock").addClass("fa fa-lock");
        } 
        else 
        {
            $('#lockPlaylistButton').removeClass("fa fa-lock").addClass("fa fa-unlock");
        }
    });

    // Message for enabling/disabling video voting
    socket.on('videoVotingSync', function (enabled)
    {
        var curVidIndex = indexById(currentVideo);
        var $curVidVoteButton = $('.video-item#' + curVidIndex + ' .video-vote-button');
        var $votedVid = $(".video-item .video-vote-button[value='Unvote']");
        if (enabled)
        {            
            if ($votedVid.length > 0)
            {
                // If you voted, you can only unvote
                $votedVid.attr({disabled: false});
            }
            else
            {
                // Otherwise allow voting on all the videos
                $('.video-item .video-vote-button').attr({disabled: false});
            }
            
            // Can't vote on current video
            $curVidVoteButton.attr({disabled: true});
        } 
        else 
        {
            $('.video-item .video-vote-button').attr({disabled: true});
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
    
    // Message for updating room settings
    socket.on('roomSettingsSync', function (settingsData)
    {
        var settings = JSON.parse(settingsData);
        document.getElementById('settingLockPlaylist').checked = settings.settingLockPlaylist;
        document.getElementById('settingVideoVoting').checked = settings.settingVideoVoting;
        document.getElementById('settingAllowSkips').checked = settings.settingAllowSkips;
        document.getElementById('settingSkipByPercent').checked = settings.settingSkipByPercent;
        $('#skipPercent').val(settings.skipPercent);
        document.getElementById('settingSkipByVotes').checked = settings.settingSkipByVotes;
        $('#skipVotes').val(settings.skipVotes);
        document.getElementById('settingVideoVoteAutoplay').checked = settings.settingVideoVoteAutoplay;
        document.getElementById('settingNormalUserMaster').checked = settings.settingNormalUserMaster;
    });    
    
    // Message for updating video votes
    socket.on('videoVoteSync', function (videoIndex, voteCount)
    {
        $('.video-item#' + videoIndex + ' .video-vote-count').html(voteCount);
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
    
    /**
     Admin specific messages
    */
    
    // Message for syncing ban list
    socket.on('banSync', function (list)
    {   
        banList = list;
        updateCPLists();
    });

    // Message for syncing mod list
    socket.on('modSync', function (list)
    {   
        modList = list;
        updateCPLists();
    });
 

});

// Event listener for when video changes state
function onPlayerStateChange(state)
{
    if (myName == masterUser)
    {
        // Pass to server
        socket.emit('playerStateChange', state);
    }
}

// Event listener for when video produces an error
function onPlayerError(error)
{
    // Doesn't matter what error, just request the next video
    if (myName == masterUser)
    {
        onPlayerStateChange(PLAYER_STATE_TYPE.finished);
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
        updateTitle(videoPlaylist[index].title);
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
        updateTitle(videoPlaylist[index].title);
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
    else if (myName == guestMasterUser)
    {
        socket.emit('guestMasterTimeSync', videoPlayer.getCurrentTime());
    }
    
    setTimeout(sendTimeSync, 2000);
}

// Send playlist move request
function serverMoveVideo(index1, index2)
{
    if (myName == masterUser || superUser)
    {
        socket.emit('videoListMove', index1, index2);
    }
}

// Tell server to tell everyone to change to my video
function serverChangeVideo(index)
{
    var vidId = videoPlaylist[index].id;
    var vidSrc = videoPlaylist[index].source;
    if ((myName == masterUser || superUser) && currentVideo != vidId)
    {    
        socket.emit('masterVideoSync', vidId);
    }
    
    if (currentVideo == "")
    {
        loadPlayerAPI(vidSrc, vidId);
    }
}

// Change to specific video
function changeVideo(videoId, source)
{
    if (currentVideo == "")
    {        
        // Get initial player size from css container
        playerWidth = parseInt($('#videoDivContainer').css('width'));
        playerHeight = parseInt($('#videoDivContainer').css('height'));
        $('#NNDOverlay').css({width: playerWidth, height: playerHeight});
    }
    
    // Switch player API, if necessary
    if (source != APImode)
    {
        loadPlayerAPI(source, videoId);
    }
    else
    {
        videoPlayer.loadVideoById(videoId);
    }
    
    if (source != "yt" && source != "dm")
    {
        // Hide playing indicator
        $('.playing-indicator').hide();
        
        // Don't need to do anything else for streams
        return;
    }
    
    var index = indexById(videoId);
    currentVideo = videoId;
    serverVideo = currentVideo;
    updateTitle(videoPlaylist[index].title);
    APImode = source;
    
    // Set vote button display
    var $voteButton = $('.video-item#' + index + ' .video-vote-button');
    var userVotedForVideo = ($voteButton.val() == 'Unvote');
    
    // Disable voting for this video
    $voteButton.attr({disabled: true}).val('Vote');

    // Renable voting for all others if vote wasn't used
    if (userVotedForVideo)
    {
        $('.video-item .video-vote-button').not($voteButton).attr({disabled: false});
    }
    
    // Set indicator for currently playing video
    setPlayingIndicator();
}

// Go to next video in playlist -- DEPRECATED: Use changeVideo()
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
    
    updateTitle(videoPlaylist[currentVidIndex].title);
   
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
    var $newDiv = $('<DIV>', {html: msg + ' ', class: 'server-msg'});
    $('#serverMessages').append($newDiv);
    $newDiv.hide().fadeIn("fast");
    
    var delayTime = $('.server-msg').length;
    $newDiv.delay(fadeDelay * delayTime).fadeOut(fadeTime, function () 
    { 
        $(this).remove(); 
    });
}

// Toggles master controls -- TODO: Rename this
function displayMasterControls(showControls)
{
    if (showControls)
    {
        $('.sortable').sortable({ disabled: false });
        $('.master-control').show();
        $('.make-master-user').show();   
        
        if (superUser)
        {
            $('.admin-control').show();
        }
        
        if (modUser || superUser)
        {
            $('.mod-control').show();
        }
        
        $('.video-vote-button').hide();
        $('.video-voting-controls').css('width', '');
    }
    else
    {
        $('.sortable').sortable({ disabled: true });
        $('.master-control').hide();
        $('.make-master-user').hide();   
        $('.admin-control').hide();
        $('.mod-control').hide();
        
        $('.video-vote-button').show();
        $('.video-voting-controls').css('width', '100');
    }
}

// Tells server to change master user
function masterUserPassOff(user)
{
    if (myName == masterUser || superUser || modUser)
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
            var $indicator = $(indic);
            
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
    var buttonTop = $('#videoList').offset().top;
    var winWidth = $('#saveVidPopup').width() / 2;

    openPopup(buttonLeft-winWidth, buttonTop, '#saveVidPopup');
}

function openLoadPopup()
{
    var buttonLeft = $('#playlistLoadButton').offset().left;
    var buttonTop = $('#videoList').offset().top;
    var winWidth = $('#loadVidPopup').width() / 2;
    
    openPopup(buttonLeft-winWidth, buttonTop, '#loadVidPopup');
}

// Send saved playlist to server
function sendPlaylistSaveData()
{
    var playlistSrc = $('#playlistLoad').val();
    if ((myName == masterUser || superUser) && $('#playlistLoad').val())
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
    var buttonTop = $('#videoList').offset().top;
    var winWidth = $('#settingsPopup').width() / 2;
        
    openPopup(buttonLeft-winWidth, buttonTop, '#settingsPopup');
}

// Show CP
function showCP()
{
    updateCPLists();
    
    var buttonLeft = $('#adminCPButton').offset().left;
    var buttonTop = $('#videoList').offset().top;
    var winWidth = $('#cpPopup').width() / 2;
        
    openPopup(buttonLeft-winWidth, buttonTop, '#cpPopup');
}


function updateCPLists()
{
    // Update mod and ban divs
    $('#modList').html('');
    for (var i = 0; i < modList.length; i++)
    {
        var $modItem = $('<DIV>').attr({class: 'modItem'});
        
        var $modName = $('<SPAN>').attr({class: 'modName'});
        $modName.html(tripColorize(modList[i]));
        
        var $unmodButton = $('<SPAN>').attr({class: "clickable fa fa-times fa-lg", title: "Unmod this user"});
        
        $unmodButton.click(function () 
        {        
            var name = $(this).siblings('.modName').text();
            if (confirm("Are you sure you want to unmod " + name + "?"))
            {
                unmodUser(name);
            }
        });

        $modItem.append($modName);
        $modItem.append($unmodButton);
        
        $('#modList').append($modItem);
    }
    
    
    $('#banList').html('');    
    for (var i = 0; i < banList.length; i++)
    {
        var banDate = (banList[i].banDate) ? banList[i].banDate : 'Unknown';
        var banExpiration = (banList[i].banExpiration) ? banList[i].expiration : '?';        
        var banReason = (banList[i].reason) ? banList[i].reason : 'None';
        
        var banInfo = "Banned on: " + banDate + "\nBan length: " + banExpiration + " days\nBanned for: " + banReason;
        var $banItem = $('<DIV>').attr({class: 'banItem', title: banInfo});
        
        var $banIp = $('<SPAN>').attr({class: 'banIp'});
        $banIp.html(banList[i].ip);
        
        var $banName = $('<SPAN>').attr({class: 'banName'});
        $banName.html(tripColorize(banList[i].lastName));
        
        
        var $unbanButton = $('<SPAN>').attr({class: "clickable fa fa-times fa-lg", title: "Unban this user"});

        $unbanButton.click(function () 
        {    
            var ip = $(this).siblings('.banIp').html();
            if (confirm("Are you sure you want to unban " + ip + "?"))
            {
                unbanUser(ip);
            }
        });
        
        $banItem.append($banIp)
        if (banList[i].lastName.length > 0)
        {
            $banItem.append(', ').append($banName);
        }
        
        $banItem.append($unbanButton);
        
        $('#banList').append($banItem);
    }
    
    if (modList.length == 0)
    {
        $('#modList').html('No mods');
    }
    
    if (banList.length == 0)
    {
        $('#banList').html('No bans');    
    }
    
}

// Show room settings
function showRoomSettings()
{
    // Show popup
    var buttonLeft = $('#roomSettingsButton').offset().left;
    var buttonTop = $('#videoList').offset().top;
    var winWidth = $('#roomSettingsPopup').width() / 2;
        
    openPopup(buttonLeft-winWidth, buttonTop, '#roomSettingsPopup');
}

// Clears the playlist 
function clearPlaylist()
{
    if (confirm("Are you sure you want to clear the playlist? (Cannot undo unless you saved it beforehand)") && (myName == masterUser || superUser))
    {
        socket.emit('clearVideoList');
    }
}


// Cleans the playlist 
function cleanPlaylist()
{
    if (confirm("Are you sure you want to clean the playlist? (Cannot undo)") && (myName == masterUser || superUser))
    {
        socket.emit('cleanVideoList');
    }
}

// Shuffle the playlist
function shufflePlaylist()
{
    if (!confirm("Are you sure you want to shuffle the playlist?"))
    {
        return;
    }

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

function toggleVideoVote(videoIndex, videoId)
{
    var $voteButton = $('.video-item#' + videoIndex + ' .video-vote-button');
    if ($voteButton.val() == 'Vote')
    {
        $voteButton.val('Unvote');
        $('.video-item .video-vote-button').not($voteButton).attr({disabled: true});
    }
    else
    {
        $voteButton.val('Vote');
        
        var curVidIndex = indexById(currentVideo);
        var $curVidVoteButton = $('.video-item#' + curVidIndex + ' .video-vote-button');
        
        // Enable buttons except for currently playing video
        $('.video-item .video-vote-button').not($curVidVoteButton).attr({disabled: false});
    }

    socket.emit('toggleVideoVote', videoId);
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

function toggleVideoVoting(enabled)
{
    if (myName == masterUser || superUser)
    {
        socket.emit('toggleVideoVoting', enabled);
    }
}

function toggleVideoVoteAutoplay(enabled)
{
    if (myName == masterUser || superUser)
    {
        socket.emit('toggleVideoVoteAutoplay', enabled);
    }
}

function toggleNormalUserMaster(enabled)
{
    if (myName == masterUser || superUser)
    {
        socket.emit('toggleNormalUserMaster', enabled);
    }
}

// Load new player API
function loadPlayerAPI(newSource, videoId)
{
    swfobject.removeSWF("videoPlayer");
    $('#videoDiv, #videoPlayer').remove();
    
    // Need to make new videoDiv
    var $videoDiv = $('<DIV>').attr({id: "videoDiv"});
    
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
        updateTitle("UStream Live");
        
        $('body').append(embed);
    }
    else if (newSource == "ls")
    {
        var params = { wmode: "opaque", scale: "exactFit"};
        var atts = { id: "videoPlayer" };
        swfobject.embedSWF("http://cdn.livestream.com/chromelessPlayer/v20/playerapi.swf?channel=" + videoId + "&clip=&time=&wmode=o&autoPlay=true", "videoDiv", "100%", "100%", "9", null, null, params, atts);
        
        // Change title
        updateTitle("Livestream Live"); 
    }
    else if (newSource == "tw")
    {
        var params = { allowScriptAccess: "always", allowFullScreen: "true", wmode: "opaque", scale: "exactFit", allowNetworking: "all", flashvars: "hostname=www.twitch.tv&channel=" + videoId + "&auto_play=true&start_volume=25" };
        var atts = { id: "videoPlayer" };
        swfobject.embedSWF("http://www.twitch.tv/widgets/live_embed_player.swf?channel=" + videoId, "videoDiv", "100%", "100%", "9", null, null, params, atts);
        
        // Change title
        updateTitle("Twitch.tv Live");
    }
     
    $('#videoDivContainer').append($('#videoPlayer'));
    APImode = newSource;    
}


// Show who's master or admin user in the user list
function setMasterDisplay()
{
    $('.master-display, .admin-display, .mod-display').hide();

    for (var i = 0; i < userList.length; i++)
    {
        if (userList[i].userType == USER_TYPE.admin)
        {
            $('.user-list-user#user' + i + ' .admin-display').css("color", "red").show();
            $('.user-list-user#user' + i + ' .name-display').css("color", "red");
        }
        
        if (userList[i].userType == USER_TYPE.mod)
        {
            $('.user-list-user#user' + i + ' .mod-display').css("color", "blue").show();
            $('.user-list-user#user' + i + ' .name-display').css("color", "blue");
        }
        
        // Don't show master icon for admins. Admins are always masters.
        if (userList[i].name == masterUser && userList[i].userType != USER_TYPE.admin)
        {
            $('.user-list-user#user' + i + ' .master-display').show();
        }
    }
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
            
            var $newimage = $('<IMG>').attr({src: shrinked});
            $('#chatList').append($newimage);

            alert(shrinked.length/1000);
            
        }
    };

    reader.readAsDataURL(file); // Convert image to base64
}

// Shows the Tinypic popup box
function openTinypic()
{
    $('#iframePopup').children(':not(.default-popup-control, .popup-gripper)').remove();

    $('#iframePopup .popup-title').html('TinyPic');
    $('#iframePopupContent').empty();
    $('#tinypic_plugin_'+id).remove();
    
    $('#iframePopupContent').append("<iframe id='tinypic_plugin_"+id+"' frameborder='0' style='display: none;' scrolling='no'></iframe><br/>");
    
    showTinypicPlugin();
    
    // Show popup
    openPopup('50%', '50%', '#iframePopup');
}

// Shows the mini search popup
function openSearch()
{
    $('#iframePopup').children(':not(.default-popup-control, .popup-gripper)').remove();
    
    $('#iframePopup .popup-title').html('YouTube QuickSearch');
    $('#iframePopupContent').empty();

    // Make a search input
    var $searchBar = $('<INPUT>').attr({id: 'searchInput'});
    $searchBar.css({width: 200});
    $searchBar.keypress(function (e) 
    {
        if (e.which == 13) // Enter key
        {
            var message = $searchBar.val();
            if (message.length > 0)
            {
                $('#iframePopupContent').empty();
                executeSearch(message, 1);
            }
        }
    });
    
    // Make a search button
    var $searchButton = $('<INPUT>').attr({id: 'searchInputButton', type: 'button', value: 'Search'});
    $searchButton.click(function () 
    {        
        var message = $searchBar.val();
        if (message.length > 0)
        {
            $('#iframePopupContent').empty();
            executeSearch(message, 1);
        }   
    });
    
    $('#iframePopupContent').before('<BR>');
    $('#iframePopupContent').before($searchBar);
    $searchBar.after($searchButton);

    // Show popup
    openPopup('50%', '50%', '#iframePopup');
}

// Performs an ajax vidoe search and adds results to the popup
function executeSearch(query, startIndex)
{
    $('#iframePopupContent').empty().append('Searching...');
    $('#searchPrevButton, #searchNextButton').remove();
    
    var MAX_RESULTS = 10;
    $.ajax({
        type: 'get',
        url: 'https://gdata.youtube.com/feeds/api/videos',
        dataType: 'jsonp',
        data: 
        {
            'alt': 'jsonc',
            'q': query,
            'orderby': 'relevance',
            'start-index': startIndex,
            'max-results': MAX_RESULTS,
            'v': 2
        },
        success: function (responseObj) 
        {
            $('#iframePopupContent').empty();
            
            // Format returned data for display
            if (responseObj.data.totalItems < 1)
            {
                $('#iframePopupContent').append('No results found for "' + query + '"');
                return;
            }
            
            for (var i = 0; i < responseObj.data.items.length; i++)
            {
                var currentItem = responseObj.data.items[i];
                var url = 'http://www.youtube.com/watch?v=' + currentItem.id;
                
                var $itemContainer = $('<DIV>').attr({class: 'searchResultItem'});
                var $thumbnail = $('<IMG>').attr({src: currentItem.thumbnail.sqDefault}).css({float: 'left', verticalAlign: 'text-top', marginRight: '10', height: '50'});
                
                var $dataCenterer = $('<DIV>').css({textAlign: 'center'});
                
                var $vidLink = $('<A>').attr({href: url, class: 'searchItemTitle'}).html(currentItem.title).append('<BR>');
                
                var $addButton = $('<INPUT>').attr({type: 'button', value: 'Add'}).css({width: '100'});
                
                // Configure add button event
                $addButton.click(function ()
                {
                    var url = $(this).siblings('.searchItemTitle').attr('href');
                    if (url.length > 0)
                    {
                        $(this).attr({value: 'Added', disabled: true});
                        socket.emit('addVideo', url);
                    }
                });
                
                $dataCenterer.append($vidLink).append($addButton);
                $itemContainer.append($thumbnail).append($dataCenterer);
                
                $('#iframePopupContent').append($itemContainer);
            }
            
            // Add prev/next buttons
            var $prevButton = $('<INPUT>').attr({id: 'searchPrevButton', type: 'button', value: 'Prev'}); 
            $prevButton.click(function () 
            {
                executeSearch(query, startIndex - MAX_RESULTS);
            });
            
            var $nextButton = $('<INPUT>').attr({id: 'searchNextButton', type: 'button', value: 'Next'}); 
            $nextButton.click(function () 
            {
                executeSearch(query, startIndex + MAX_RESULTS);
            });
            
            if (startIndex > MAX_RESULTS)
            {
                $('#iframePopup').append($prevButton);
            }
            
            if (startIndex < responseObj.data.totalItems - MAX_RESULTS)
            {
                $('#iframePopup').append($nextButton);
            }
        }
    });
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
    
    if (myName == masterUser || superUser)
    {
        toggleSkipEnabled(document.getElementById('settingAllowSkips').checked);
        togglePlaylistLocked(document.getElementById('settingLockPlaylist').checked);
        toggleVideoVoting(document.getElementById('settingVideoVoting').checked);
        toggleVideoVoteAutoplay(document.getElementById('settingVideoVoteAutoplay').checked);
        toggleNormalUserMaster(document.getElementById('settingNormalUserMaster').checked);
    }
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
    $('#videoList').html('');
    $('#videoListInfo').html('');
    
    var $newList = $('<UL>').attr({class: "sortable video-list"});

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
    
    if (videoPlaylist.length == 0)
    {
        var $emptyPlaylistMsg = $('<DIV>').attr({id: 'noVideosMsg'});
        $emptyPlaylistMsg.html('Playlist is empty! Add some videos!');
        $('#videoList').append($emptyPlaylistMsg);
    }
    
    // Generate playlist controls
    var $goToControl = $('<SPAN>').attr({id: "goToIndicator", class: "clickable fa fa-bullseye fa-lg", title: "Scroll to currently playing video"});
    $goToControl.css("padding-left", "8");
    
    var $lockPlaylistControl = $('<SPAN>').attr({id: "lockPlaylistButton", class: "clickable fa fa-unlock fa-lg", title: "Playlist locking state"});
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
                serverMoveVideo(ui.item.index(), origIndex);
                
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
    
    var $newListItem = $('<LI>').attr({class: "ui-state-default video-item", id: index});
    
    var $dragger = $('<SPAN>').attr({class: "dragger fa fa-sort fa-lg master-control"});
    
    var $number = $('<SPAN>').attr({class: "video-number"});
    $number.append(index + 1 + '.');
    
    var $urlButton = $('<SPAN>').attr({class: "url-button fa fa-link fa-lg", id: index, title: "Link to video"});
    
    
    var $videoControls = $('<SPAN>').attr({class: "video-controls master-control"});
    
    var $playButton = $('<SPAN>').attr({class: "play-button fa fa-play-circle fa-lg clickable master-control", id: "tit" + index, title: "Play this video"});
    
    var $bumpButton = $('<SPAN>').attr({class: "bump-button fa fa-arrow-up fa-lg clickable master-control", id: index, title: "Bump as next video to play"});
    
    var $deleteButton = $('<SPAN>').attr({class: "delete-button fa fa-times fa-lg master-control", id: index, title: "Double-click to delete"});
    
    $videoControls.append($playButton).append($bumpButton).append($deleteButton);
    
    
    var $videoVoteControls = $('<SPAN>').attr({class: "video-voting-controls"});
    
    var $videoVoteButton = $('<INPUT>').attr({class: "video-vote-button", type: "button", value: "Vote"});
    
    var $videoVoteCount = $('<SPAN>').attr({class: "video-vote-count"}).html("0");
    $videoVoteControls.append($videoVoteButton).append(" ").append($videoVoteCount);
    
    var $playingIndicator = $('<SPAN>').attr({class: "playing-indicator fa fa-youtube-play fa-lg", id: index});
    
    var $vidTitle = $('<SPAN>').attr({class: "video-title"});
    $vidTitle.append(videoPlaylist[index].title);
     
    var $vidDuration = $('<SPAN>').attr({class: "video-duration"});
    
    $vidDuration.append(secondsToTime(videoPlaylist[index].duration));
    var $vidAddedBy = $('<SPAN>').attr({class: "video-addedBy"});
    $vidAddedBy.append('added by ' + videoPlaylist[index].addedBy);
    
    var $topRow = $('<DIV>').attr({class: "playlist-item-top-row"});
    var $bottomRow = $('<DIV>').attr({class: "playlist-item-bottom-row"});
    
    $topRow.append($number);
    $topRow.append($vidTitle);
    $topRow.append($playingIndicator);
    
    $bottomRow.append($dragger);
    $bottomRow.append($urlButton);
    $bottomRow.append($vidAddedBy);
    $bottomRow.append($vidDuration);
    $bottomRow.append($videoControls);
    $bottomRow.append($videoVoteControls);
    
    $newListItem.append($topRow);
    $newListItem.append($bottomRow);
    
    $playingIndicator.hide();
    
    // Marquee long video titles (except in Chrome, since it gets retarded with them)
    if (getTextWidth(videoPlaylist[index].title) >= $vidTitle.width() && !usingChrome)
    {
        var $marquee = $('<MARQUEE>').attr({behavior: "alternate", scrollDelay: "200", hspace: "10", scrollAmount: "0"});
        
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
        
        $videoVoteButton.click(function ()
        {
            var vidId = getIdForVideoItem(this);
            var id = videoPlaylist[vidId].id;
            toggleVideoVote(index, id);
        });
        
        $bumpButton.click(function() {
            var id = getIdForVideoItem(this);
            
            // Get position right after currently playing video, or loop back
            var curVidIndex = indexById(currentVideo);
            
            if ((curVidIndex == videoPlaylist.length && id == 0) || curVidIndex == id || 
                id == curVidIndex + 1)
            {
                alert("That video is already playing or will be played next");
                return;
            }

            if (curVidIndex > -1)
            {
                var newPos = 0;
                if (curVidIndex < videoPlaylist.length - 1)
                {
                    newPos = curVidIndex + 1;
                }
                serverMoveVideo(newPos, id);
            }
        });
        
        // Hide voting button
        $videoVoteButton.hide();
        $('.video-voting-controls').css('width', '');
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
        var $thumbnail = $('<IMG>').attr({class: "thumbnail", src: imgUrl});
        $('#thumbnailPopup').html('');
        $('#thumbnailPopup').append(videoPlaylist[id].title + "<BR>");
        $('#thumbnailPopup').append($thumbnail);
       
        hoverTimeout = setTimeout(function() {
            $('#thumbnailPopup').show().offset({left:e.pageX-180,top:e.pageY-360}).fadeTo(1, 0.8);
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
        $('#addVideoInput').show().css({ width: 0 }).animate({ width: 250 }, 'fast');
    }
    else
    {
        $('#addVideoButton').removeAttr('disabled');        
        $('#addVideoInput').css({ width: 250 }).animate({ width: 0 }, 'fast', 'swing', 
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

// Sets up input text for sending a whisper command
function setPrivateMessage()
{
    var username = userList[userPopupId].name;
    var str = '/w ' + username + ' ';
    $('#closeUserPopup').click();
    $('#chatInput').focus().val(str);
}

// Boots a user from the room
function bootUser()
{
    if (myName == masterUser || superUser)
    {
        var username = userList[userPopupId].name;
        socket.emit('bootUser', username);
        $('#closeUserPopup').click();
    }   
}

// Asks for ban reason and length
function banConfirm()
{   
    var name = $('#userPopup').find('#userPopupName').text();
    $('.ban-name').html(tripColorize(name));
    
    openPopup($('#userPopup').offset().left + 20, $('#userPopup').offset().top, '#banUserPopup');
}

// Sets the views user popup settings
function userSettingsCheck()
{
    if (userList[userPopupId].muted)
    {
        $('.mute-button').removeClass('fa fa-volume-up').addClass('fa fa-volume-off');
    }
    else
    {
        $('.mute-button').removeClass('fa fa-volume-off').addClass('fa fa-volume-up');
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

// Updates the document title and video title text
function updateTitle(str)
{
    document.getElementById("videoTitle").innerHTML = str;
    document.title = str + " - KachoTube";
}


// Takes some text, scans for ! and returns a colorized version
function tripColorize(trip)
{    
    var namePart, tripPart;
    var tripFound = trip.match(/!/g);
    if (tripFound)
    {
        var splitName = trip.split("!");
        namePart = splitName[0];
        tripPart = "!" + splitName[1];
        tripPart = "<SPAN Class = 'trip-display greentext'>" + tripPart + "</SPAN>";
        return namePart + tripPart;
    }
    
    return trip;
}

/**
 Admin specific functions
 
 WARNING: Attempting to call these manually 
 will result in an immediate permaban
 */
 
function banUser()
{
    var name = $('#userPopup').find('#userPopupName').text();
    if (name.length == 0)
    {
        alert("Couldn't get name!");
        return;
    }
    
    var reason = $('.ban-reason-input').val();
    var length = $('.ban-length-input').val();
    
    if (superUser || modUser)
    {
        socket.emit('banUser', name, reason, length);
    }
    
    $('#closeBanUserPopup').click();
    $('#closeUserPopup').click();
}

function unbanUser(ip)
{
    socket.emit('unbanUser', ip);
}

function addMod()
{
    if (superUser || modUser)
    {
        var trip = userList[userPopupId].name;
        socket.emit('modUser', trip);
        $('#closeUserPopup').click();
    }
}

function unmodUser(trip)
{
    socket.emit('unmodUser', trip);
}

KachoTube
=========
Quick and easy to deploy single-room SynchTube clone built on socket.io and node.js.

<a href="https://raw.github.com/Gunbard/KachoTube/master/readme-img/kachotube.png" target="_blank"><img src="https://raw.github.com/Gunbard/KachoTube/master/readme-img/kachotube-thumb.png" 
alt="Kacho in action"/></a>

###Features
* Synchronized video and chat
  * Current master user's video is synced to server, which syncs the other users
  * If there is no master user, and the setting for letting normal users become master users is disabled, then a guest master user may be appointed automatically
  * A guest master user may only manipulate the player time sync
* Currently supported video sources
  * YouTube
  * DailyMotion
* Currently supported streaming sites
  * UStream
  * Livestream
  * Twitch.tv
* Image and video embedding in chat (provided by TinyPic)
  * Users can disable either
  * Users can select size
  * TinyChat quick upload popup window
* Playlist
  * All users may add videos to an unlocked playlist as well as save the entire playlist
  * Master users may also 
     * Delete videos
     * Load a saved playlist 
     * Re-arrange playlist order 
     * Shuffle the playlist 
     * Clear the playlist 
     * Clean (delete up to currently playing video)
     * Bump a video (make video next to play)
  * Videos are verified before being added
  * Show URL
  * Thumbnail preview on hover
* Youtube QuickSearch
  * Inline YouTube search to instantly find and add videos
* Users 
  * Semi-anonymous, users may change names
  * Zero-registration
  * Tripcode support
  * Mute
  * Whispering
  * Save settings to local storage
* Administration
  * Add generated tripcode to list of admins before deploying
  * Add/remove mods
  * Add/remove bans
  * Always has full control of playlist
* Moderators
  * Must be tripcoded
  * Can boot or ban users
  * Can steal master user token
* Fun crap
  * NicoNico style comments
    * Comments and image embeds will scroll across the video
* Server
  * Anti-spam (largely untested in real world)
     * Auto-disconnect when messages/sec exceeds threshold
     * Chat embed cooldown timer
  * Persistent settings
     * Saves playlist and reloads on server start
     * Saves list of mods and bans and reloads on server start

### Configuration
* To add an administrator (important) you will need to generate a tripcode from the server itself
  * Run and connect to the server
  * Open the settings (the icon with 3 gears above the playlist)
  * Generate a tripcode in the format "yourName#yourSecretKey"
  * Copy the full name
  * Create a file in same directory where server.js is named "admins.txt"
  * Paste your tripcode in this format: `["yourName!tripcode"]`
  * Save and restart the server

This file will be loaded every time on server start

###To deploy
* Clone project somewhere
* Install node.js using your favorite package manager or from the website
  * Installing node.js should also install its package manager, npm
* `cd /path/to/KachoTube`
* `npm install express request socket.io`
* `node server.js`

Your room will be running on port 80 by default.



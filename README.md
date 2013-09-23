##KachoTube
=========

Quick and easy to deploy single-room SynchTube clone built on socket.io and node.js.

###Features
* Synchronized video and chat
* Currently supported video sources
  * YouTube
  * DailyMotion
* Image and video embedding in chat (provided by TinyPic)
  * Users can disable either
  * Users can select size
  * TinyChat quick upload popup window
* Playlist
  * All users may add videos to an unlocked playlist as well as save the entire playlist
  * Master users may also delete, load, re-arrange, shuffle, clear, and clean (delete up to currently playing video)
  * Videos are verified before being added
* Users 
  * Semi-anonymous, users may change names
  * Zero-registration
  * Tripcode support
  * Mute
  * Whispering
  * Save settings to local storage
* Administration
  * Add generated tripcode to list of admins 
* Fun crap
  * NicoNico style comments
    * Comments and image embeds will scroll across the video
* Anti-spam (largely untested in real world)
  * Auto-disconnect when messages/sec exceeds threshold
  * Chat embed cooldown timer


###To deploy
TODO

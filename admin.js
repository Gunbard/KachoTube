/**
 Admin specific functions and messages
 
 WARNING: Unauthorized attempts to call these will result in an
 immediate permaban
 */
 
 
//// SOCKET MESSAGES

// Message for syncing ban list
socket.on('banSync', function (list)
{   
    banList = list;
    // Update UI
});

// Message for syncing mod list
socket.on('modSync', function (list)
{   
    modList = list;
    // Update UI
});
 
//// FUNCTIONS
 
function banUser(name)
{
    socket.emit('banUser', name, "", 0);
}

function unbanUser(name)
{

}

function modUser(trip)
{

}

function unmodUser(trip)
{

}
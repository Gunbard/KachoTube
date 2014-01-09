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
    updateCPLists();
});

// Message for syncing mod list
socket.on('modSync', function (list)
{   
    modList = list;
    updateCPLists();
});
 
//// FUNCTIONS
 
function banUser(name, reason, length)
{
    socket.emit('banUser', name, reason, length);
}

function unbanUser(ip)
{
    socket.emit('unbanUser', ip);
}

function modUser(trip)
{
    socket.emit('modUser', trip);
}

function unmodUser(trip)
{
    socket.emit('unmodUser', trip);
}
const express = require('express');
const path = require('path');
const http = require('http');
const socketio = require('socket.io');
const Filter = require('bad-words');
const {
  generateMessage,
  generateLocationMessage
} = require('./utils/messages');
const {
  addUser,
  removeUser,
  getUser,
  getUsersInRoom
} = require('./utils/users');

const app = express();
// allows us to create a new web server and we're going to pass to it
// our Express application. If we don't do this, the Express library does
// this behind the scenes anyaways.
const server = http.createServer(app);
// configure socketio to work with a given server.
// socketio expects it to be called with the raw http server. When express
// creates that behind the scenes we don't have access to it to pass in right
// here. That's why we create it on our own(const server = http.createServer(app);)
// we created it for the explicit purpose of being able to pass it in right here.
// Now our server supports websocket
const io = socketio(server);

const publicDirectoryPath = path.join(__dirname, '../public');

app.use(express.static(publicDirectoryPath));

// Event: connection. The connection is going to fire whenever the socketio server
// gets a new connection.
// The argument, socket, is an object that contains information about that new connection
io.on('connection', socket => {
  console.log('New WebSocket connenction');

  socket.on('join', ({ username, room }, callback) => {
    const { error, user } = addUser({ id: socket.id, username, room });

    if (error) {
      return callback(error);
    }

    socket.join(user.room);
    socket.emit('message', generateMessage('Admin', 'Welcome!'));
    socket.broadcast
      .to(user.room)
      .emit('message', generateMessage('Admin', `${user.username} has joined!`));
    
    io.to(user.room).emit('roomData', {
        room: user.room,
        users: getUsersInRoom(user.room)
    })

    callback();
  });

  socket.on('sendMessage', (message, callback) => {
    const user = getUser(socket.id);

    const filter = new Filter();

    if (filter.isProfane(message)) {
      return callback('Profanity is not allowed!');
    }

    io.to(user.room).emit('message', generateMessage(user.username, message));
    callback();
  });

  socket.on('sendLocation', (coords, callback) => {
    const user = getUser(socket.id);

    io.to(user.room).emit(
      'locationMessage',
      generateLocationMessage(
          user.username,
        `https://google.com/maps?q=${coords.latitude},${coords.longitude}`
      )
    );
    callback();
  });

  socket.on('disconnect', () => {
    const user = removeUser(socket.id);

    if (user) {
      io.to(user.room).emit(
        'message',
        generateMessage('Admin', `${user.username} has left!`)
      );
      io.to(user.room).emit('roomData', {
          room: user.room,
          users: getUsersInRoom(user.room)
      })
    }
  });
});

// Instead of calling app.listen, we're going to call server.listen
// to start up our http server.
server.listen(process.env.PORT, () => {
  console.log(`Listening to PORT ${process.env.PORT}`);
});

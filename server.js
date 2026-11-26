const path = require('path');
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: true }, maxHttpBufferSize: 1e6 });
const rooms = new Map();
const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
function newCode(){let code;do{code=Array.from({length:6},()=>alphabet[Math.random()*alphabet.length|0]).join('')}while(rooms.has(code));return code}
app.use(express.static(__dirname, { extensions: ['html'] }));
app.get('/', (req,res)=>res.sendFile(path.join(__dirname,'index.html')));
app.get('/health', (req,res)=>res.json({ok:true}));
io.on('connection', socket => {
  socket.on('create', () => { if(socket.data.room)return; const code=newCode(); rooms.set(code,{host:socket.id,guest:null});socket.data={room:code,role:'host'};socket.join(code);socket.emit('created',{code}); });
  socket.on('join', raw => { const code=String(raw||'').toUpperCase().replace(/[^A-Z0-9]/g,'').slice(0,12);const room=rooms.get(code);if(!room||room.guest){socket.emit('connect_error',{message:'満員またはルームがありません'});return}room.guest=socket.id;socket.data={room:code,role:'guest'};socket.join(code);socket.emit('joined',{code});io.to(room.host).emit('opponent',{connected:true}); });
  socket.on('action', action => {const room=rooms.get(socket.data.room);if(!room||socket.data.role!=='guest'||!action||typeof action!=='object')return;io.to(room.host).emit('action',action)});
  socket.on('state', state => {const room=rooms.get(socket.data.room);if(!room||socket.data.role!=='host')return;socket.to(socket.data.room).emit('state',state)});
  socket.on('start',()=>{const room=rooms.get(socket.data.room);if(room&&socket.data.role==='host')socket.to(socket.data.room).emit('start')});
  socket.on('restart',()=>{const room=rooms.get(socket.data.room);if(room&&socket.data.role==='host')socket.to(socket.data.room).emit('restart')});
  socket.on('disconnect',()=>{const code=socket.data.room,room=rooms.get(code);if(!room)return;if(socket.data.role==='host'){io.to(code).emit('host-left');rooms.delete(code)}else{room.guest=null;io.to(room.host).emit('opponent',{connected:false})}});
});
const port=Number(process.env.PORT)||3000;
server.listen(port,()=>console.log(`狸は同じ場所にうんこする: http://localhost:${port}`));
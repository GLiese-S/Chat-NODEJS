var express = require('express'); // подключение модуля express
var app = express(); // заворачиваем express в приложение
var serv = require('http').Server(app); // подключение модуля http
 
app.get('/',function(req, res) {
	res.sendFile(__dirname + '/client/index.html'); // отправка пользователю файла index.html
});

app.use('/client',express.static(__dirname + '/client')); //предоставление статических файлов модулю express 
														  //(пишется дирректория куда все складывать) можно использовать 
														  // несколько раз с разными дирректориями
														  // по идее надо писать это перед app.get ???
 
serv.listen(2000); // Запуск сервера вызовом метода listen объекта server с номером порта для прослушивания 2000
console.log("Server started."); // Для удобства вывод в консоль информации о запуске сервера
 
var SOCKET_LIST = {}; // объект для занесния сокетов
 
var Entity = function(){ // сущность для использования в PLAYER and BULLET

	var self = { // начальная позиция для используемых объектов (центр квадрата), начальные значения скорости и идентификатор
		x:250,
		y:250,
		spdX:0,
		spdY:0,
		id:"",
		
	}

	self.update = function(){ // завернутый метод обновления позиции
		self.updatePosition();
	}

	self.updatePosition = function(){ // метод обновления позиции
		self.x += self.spdX; 
		self.y += self.spdY;
	}

	return self; 
}
 
var Player = function(id){

	var self = Entity(); // наследование сущности к игроку
	self.id = id;
	self.number = "" + Math.floor(10 * Math.random()); // присвоение случайного номера
	self.pressingRight = false; // по умолчанию клавиши не нажаты
	self.pressingLeft = false;
	self.pressingUp = false;
	self.pressingDown = false;
	self.maxSpd = 10; // шаг перемещения
 
	var super_update = self.update;

	self.update = function(){

		self.updateSpd();
		super_update();
	}
 
 
	self.updateSpd = function(){ // описание движения игрока в зависимости от нажатий клавиш

		if(self.pressingRight)
			self.spdX = self.maxSpd;
		else if(self.pressingLeft)
			self.spdX = -self.maxSpd;
		else
			self.spdX = 0;
 
		if(self.pressingUp)
			self.spdY = -self.maxSpd;
		else if(self.pressingDown)
			self.spdY = self.maxSpd;
		else
			self.spdY = 0;		
	}

	Player.list[id] = self;
	return self;
}

Player.list = {}; // список игроков
Player.onConnect = function(socket){ // то что происходит при подключении клиента

	var player = Player(socket.id);

	socket.on('keyPress',function(data){ // получение с фронта данных о нажатии функциональных клавиш

		if(data.inputId === 'left')
			player.pressingLeft = data.state;
		else if(data.inputId === 'right')
			player.pressingRight = data.state;
		else if(data.inputId === 'up')
			player.pressingUp = data.state;
		else if(data.inputId === 'down')
			player.pressingDown = data.state;
	});
}

Player.onDisconnect = function(socket){

	delete Player.list[socket.id]; // очистка позиции в листе игроков при отсоединении клиента
}

Player.update = function(){ // функция обновления позиции игроков

	var pack = []; //массив для занесения позиций

	for(var i in Player.list){

		var player = Player.list[i];
		player.update(); // обновление позиции
		pack.push({ // занесение в массив для отправки данных о положении игроков

			x:player.x,
			y:player.y,
			number:player.number

		});	
	}
	return pack;
}
 
 
var Bullet = function(angle){ // описание того, чтио пульки делают

	var self = Entity(); // наследование данных с Entity
	self.id = Math.random(); 
	self.spdX = Math.cos(angle/180*Math.PI) * 10;
	self.spdY = Math.sin(angle/180*Math.PI) * 10;
 	self.timer = 0; // начальное значение таймера, который считает до 100
	self.toRemove = false; 
	var super_update = self.update;

	self.update = function(){

		if(self.timer++ > 100) // уничтожение пульки при жизни больше 100 шагов
			self.toRemove = true;
		super_update();

	}

	Bullet.list[self.id] = self; // занесение данных в объект для хранения пулек
	return self;
}

Bullet.list = {}; // объект для хранения и записи пулек
 
Bullet.update = function(){ 

	if(Math.random() < 0.1){
		Bullet(Math.random()*360);
	}
 
	var pack = []; // массив для обновления отправки текущих положений пулек 
	for(var i in Bullet.list){

		var bullet = Bullet.list[i];
		bullet.update();
		pack.push({ 
			x:bullet.x,
			y:bullet.y,
		});		
	}
	return pack; // отправка массива пулек
}
 
var DEBUG = true; // переменная для активации дебага
 
var io = require('socket.io')(serv,{}); // получение и подключение socket.io

io.sockets.on('connection', function(socket) {	// все что может происходить при соединении клиента

	socket.id = Math.random(); // присвоение случайного числа для массива 
	SOCKET_LIST[socket.id] = socket; // создание записи в сокет листе
 
	Player.onConnect(socket); // соединение игрока 
 
	socket.on('disconnect',function(){ //все что происходит при отключении юзера
	
		delete SOCKET_LIST[socket.id]; // очистка массива сокетов
		Player.onDisconnect(socket); // освобождение подключенного сокета

	}); 

	
	socket.on('sendMsgToServer',function(data){ // получение сообщения и имени, обработка и отправка на каждого клиента
		
		for(var i in SOCKET_LIST){ // отправка каждому юзеру Имени пользователя и сообщения
			SOCKET_LIST[i].emit('addToChat',data.myName + ': ' + data.myText);
		}
	});
 
	socket.on('evalServer',function(data){ // отладка 

		if(!DEBUG)
			return;
		var res = eval(data);
		socket.emit('evalAnswer',res);		
	});
 
});


setInterval(function(){ // циклическое выполнение функции отправки объекта 'pack' на фронтенд

	var pack = { // объект с позициями игрока и пуль
		player:Player.update(), 
		bullet:Bullet.update(),
	}
 
	for (var i in SOCKET_LIST){ // 
		var socket = SOCKET_LIST[i]; 
		socket.emit('newPositions', pack); // отправка объекта 'pack' на всех клиентов
	}

}, 1000/20); // интервал выполнения функции
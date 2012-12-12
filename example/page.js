// create waypoints from the dom nodes on the page
var points = Scrolling.addWaypoint('.waypoint');
// bind clicks to debug btns
var debug_btns = document.querySelectorAll('.debug');
var i = debug_btns.length;
while( i-- ) {
	debug_btns[i].addEventListener('click', function(){
		Scrolling.debug();
	}, false);
};

// some stuff to move around
var Mover = function(el) {
	this.elem = el;
	this.angle = 0;
	this.radius = Math.floor(Math.random()*Scrolling.viewport.width/3);
	this.init = Math.floor(Math.random()*(Scrolling.viewport.height));
	this.pos = {
		x: 0,
		y: 0
	};
	this.rmod = Math.floor(Math.random()*100) + 100;
	this.update();
};
Mover.prototype.update = function() {
	this.angle = this.init + Scrolling.position.y;
	this.pos.x = this.radius * Math.cos(this.angle/this.rmod) + (Scrolling.viewport.width/2);
	this.pos.y = this.radius * Math.sin(this.angle/this.rmod) + (Scrolling.viewport.height/2);
	this.elem.style.left = this.pos.x + 'px';
	this.elem.style.top = this.pos.y + 'px';
}
var move_elems = document.querySelectorAll('.mover');
var movers = [];
var l = move_elems.length;
var i = -1;
while (++i < l) {
	movers.push(new Mover(move_elems[i]));
};
Scrolling.onScroll = function() {
	var i = -1;
	var l = move_elems.length;
	var m;
	while (++i < l) {
		movers[i].update();
	};
};

// backgrounds on individual waypoints
Scrolling.waypoints[0].onVisible = function() {
	this.domNode.style.backgroundPosition = 'center ' + ((this.position.y/2) - 50) + 'px'
}

Scrolling.waypoints[1].onVisible = function() {
	this.domNode.style.backgroundPosition = 'center ' + ((-this.position.y/2)) + 'px'
}

Scrolling.waypoints[2].onVisible = function() {
	this.domNode.style.backgroundPosition = 'center ' + ((-this.position.y/0.5)) + 'px'
}

Scrolling.waypoints[3].onVisible = function() {
	this.domNode.style.backgroundPosition = 'center ' + (-this.position.y) + 'px'
}

Scrolling.waypoints[4].onVisible = function() {
	this.domNode.style.backgroundPosition = 'center ' + ((this.position.y*0.3) - 200) + 'px'
}
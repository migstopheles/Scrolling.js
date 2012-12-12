// one global instance to report scrolling events
var Scrolling = Scrolling || (function () {

    // ====== helper funcs ========
    var help = {
        // iterator
        forEach: function (list, fn) {
            if ('forEach' in list) return list.forEach(fn);
            if (list instanceof Array || !!list.length) {
                for (var i = 0, l = list.length; i < l;) fn.call(list[i], list[i], i++);
            } else {
                for (var i in list) fn.call(list[i], list[i], i);
            };
        },
        // use css selectors
        query: (function(){
            var qsFunc = function(selector, context) { return selector.nodeType ? [selector] : (context || document).querySelectorAll(selector); };
            var jqFunc = function(selector, context) { return $(selector,(context || null)).toArray(); };
            var noFunc = function(selector, context) { return [selector + " - dependency required"]; };
            return !!document.querySelectorAll ? qsFunc : !!window.jQuery ? jqFunc : noFunc;
        })(),
        // bind event to elem
        bind: (function (attach) {
            return attach ? function (elm, evt, fn) {
                elm["evt" + evt + fn] = fn;
                elm[evt + fn] = function () { elm["evt" + evt + fn](window.event) };
                elm.attachEvent("on" + evt, elm[evt + fn]);
            } : function (elm, evt, fn) { elm.addEventListener(evt, fn, false); }
        })(window.attachEvent),
        // get offset of element
        getOffset: function (elm) {
            if (!elm) return { top: 0, left: 0 };
            var ol = 0, ot = 0, offset_elm = elm;
            while (offset_elm) {
                ol += offset_elm.offsetLeft;
                ot += offset_elm.offsetTop;
                offset_elm = offset_elm.offsetParent;
            };
            return { top: ot, left: ol };
        }
    };

    //  ===== private methods =====
    // get current scroll position
    var scrollPostitions = (function (docelem) {
        var func1 = function () { return { x: window.scrollX, y: window.scrollY }; };
        var func2 = function () { return { x: docelem.scrollLeft, y: docelem.scrollTop }; };
        return typeof window.scrollY === 'number' ? func1 : func2;
    })(document.documentElement);

    // private Waypoint class
    var Waypoint = (function () {
        
        var Waypoint = function (elem) {
            this.domNode = elem;
            this.setData();
            this.debugmode = false;
            this.position = {
                x: 0,
                y: 0
            };
            this.visible = false;
            this.scrollPercent = {
                x: 0,
                y: 0
            };
        };
        Waypoint.prototype = {
            // display debug info in top left of waypoint
            debug: function () {
                if (this.debugmode) return;
                this.debugmode = true;
                var x;
                var hex = (Math.floor(Math.random() * 16777215)).toString(16);
                var colour = '#' + hex;
                var output = document.createElement('div');
                var bounds = document.createElement('div');
                var props = { position: 'fixed', zIndex: 99999, background: '#000', color: colour, padding: '1em', font: '12px/1.4em "Consolas", "Courier New", monospace' };
                for (x in props)  output.style[x] = props[x];
                props = { position: 'fixed', background: 'rgba(20,20,20,0.2)', zIndex: 99998, border: '2px solid ' + colour, width: this.width + 'px', height: this.height + 'px', top: '0px', left: '0px' };
                for (x in props) bounds.style[x] = props[x];
                document.body.appendChild(output);
                document.body.appendChild(bounds);
                // enhance existing onScroll method
                var _onScroll = this.onScroll;
                this.onScroll = function () {
                    if (!this.visible) {
                        output.style.display = 'none';
                        bounds.style.display = 'none';
                        return;
                    } else {
                        output.style.display = 'block';
                        bounds.style.display = 'block';
                    }
                    var debug_html = 'position: {x: ' + this.position.x + ', y: ' + this.position.y + '}<br />';
                    debug_html += 'Scroll range: {x: ' + this.scrollRange.x + ', y: ' + this.scrollRange.y + '}<br />';
                    debug_html += 'Scroll completion: { x: ' + parseInt(this.scrollPercent.x * 100000) / 1000 + '%, ';
                    debug_html += 'y:' + parseInt(this.scrollPercent.y * 100000) / 1000 + '%<br />';
                    debug_html += 'offset: {top: ' + this.offset.top + ', left: ' + this.offset.left + '}<br />';
                    debug_html += 'width: ' + this.width + 'px <br />height: ' + this.height + '<br />';
                    output.innerHTML = debug_html;
                    output.style.top = bounds.style.top = this.position.y + 'px';
                    output.style.left = bounds.style.left = this.position.x + 'px';
                    _onScroll.call(this);
                };
            },
            setData: function () {
                this.offset = help.getOffset(this.domNode);
                this.height = this.domNode.clientHeight;
                this.width = this.domNode.clientWidth;
                this.scrollRange = {
                    x: Scrolling.viewport.width + this.width,
                    y: Scrolling.viewport.height + this.height
                };
            },
            update: function () {
                this.position = {
                    x: this.offset.left - Scrolling.position.x,
                    y: this.offset.top - Scrolling.position.y
                };
                this.scrollPercent = {
                    x: (Scrolling.viewport.width - this.position.x) / this.scrollRange.x,
                    y: (Scrolling.viewport.height - this.position.y) / this.scrollRange.y
                };
                var prev_vis = this.visible;
                this.isVisible();
                this.onScroll();
                if (this.visible) {
                    this.onVisible.call(this);
                }
                if (this.visible !== prev_vis) {
                    this.onVisibilityChange.call(this);
                    Scrolling.onWaypointChanged(this);
                }
            },
            isVisible: function () {
                // vertically visible
                return this.visible = (this.position.y + this.height > 0 && this.position.y < Scrolling.viewport.height
                // horizontally visible
                && this.position.x + this.width >= 0 && this.position.x < Scrolling.viewport.width);
            },
            onScroll: function () { },
            onVisible: function () { },
            onVisibilityChange: function () { }
        };
        return Waypoint;
    })();

    var ScrollHooks = function () {

        var self = this;
        // whether it has been applied or not
        this.applied = false;

        // directions 'enum'
        this.directions = {
            UP: 'up',
            DOWN: 'down',
            LEFT: 'left',
            RIGHT: 'right'
        };
        
        // current scroll direction
        this.direction = {
            x: this.directions.RIGHT,
            y: this.directions.DOWN
        };

        //current scroll position
        this.position = { x: 0, y: 0 };
        
        // is debugging?
        this.debugmode = false;

        // the total visible area of the screen
        this.viewport = {
            width: document.documentElement.clientWidth,
            height: document.documentElement.clientHeight
        };

        // the currently visible area of the screen
        this.visible = {
            width: this.viewport.width,
            height: this.viewport.height
        };

        // collection of waypoints
        this.waypoints = [];

        // queue of waypoints to apply on page load
        this.queue = [];

        // bind scroll func to window on load
        help.bind(window, 'load', function () {
            self.applied = true;
            // update any queued waypoints
            help.forEach(self.queue, function () {
                self.queue.splice(0, 1)[0].setData();
            });
            help.bind(window, 'scroll', function () {
                self.update();
            });
            document.documentElement.className += ' scroll-loaded';
            self.update();
            self.onLoad();
        });

    };

    ScrollHooks.prototype = {
        // display debug info in top right
        debug: function () {
            if (this.debugmode) return;
            this.debugmode = true;
            var i = this.waypoints.length;
            var x;
            var output = document.createElement('div');
            var props = { position: 'fixed', zIndex: 99999, top: '0px', right: '0px', background: '#000', color: '#fff', padding: '1em', font: '12px/1.4em "Consolas", "Courier New", monospace' };
            for (x in props) output.style[x] = props[x];
            document.body.appendChild(output);
            // debug all waypoints
            while (i--) this.waypoints[i].debug();
            // enhance existing onScroll method
            var _onScroll = this.onScroll;
            this.onScroll = function () {
                var debug_html = 'position: {x: ' + this.position.x + ', y: ' + this.position.y + '}<br />';
                debug_html += 'viewport: {width: ' + this.viewport.width + ', height: ' + this.viewport.height + '}<br />';
                debug_html += 'visible: {width: ' + this.visible.width + ', height: ' + this.visible.height + '}<br />';
                debug_html += 'direction: {x: ' + this.direction.x + ', y: ' + this.direction.y + '}<br />';
                output.innerHTML = debug_html;
                _onScroll.call(this);
            };
            // force update
            window.scroll(Scrolling.position.x + 1, Scrolling.position.y + 1);
            window.scroll(Scrolling.position.x - 1, Scrolling.position.y - 1);
        },
        // update positions
        update: function () {
            var oldpos = {
                x: this.position.x,
                y: this.position.y
            };
            this.position = scrollPostitions();
            this.viewport = {
                width: document.documentElement.clientWidth,
                height: document.documentElement.clientHeight
            };
            this.visible = {
                height: this.viewport.height + this.position.y,
                width: this.viewport.width + this.position.x
            };
            if (this.position.x > oldpos.x) {
                this.direction.x = this.directions.RIGHT;
            } else if (this.position.x < oldpos.x) {
                this.direction.x = this.directions.LEFT;
            }
            if (this.position.y > oldpos.y) {
                this.direction.y = this.directions.DOWN;
            } else if (this.position.y < oldpos.y) {
                this.direction.y = this.directions.UP;
            }
            // update visible waypoints
            var i = this.waypoints.length;
            while (i--)  this.waypoints[i].update();
            this.onScroll.call(this);
        },
        // add waypoints - accepts single HTML Element, iterable collection of HTML elements, or selector
        addWaypoint: function (point) {
            var self = this;
            if (typeof point === 'string') { // assume css selector
                help.forEach(help.query(point), function (p) {
                    var wp = new Waypoint(p);
                    if (self.debugmode) wp.debug();
                    wp.uid = self.waypoints.length;
                    self.waypoints.push(wp);
                    if (!self.applied) {
                        self.queue.push(wp);
                    };
                });
            } else if ('nodeName' in point) { // assume html element
                var wp = new Waypoint(point);
                if (self.debugmode) wp.debug();
                wp.uid = self.waypoints.length;
                self.waypoints.push(wp);
                if (!self.applied) {
                    self.queue.push(wp);
                };
                return wp;
            } else { // assume collection of elements
                help.forEach(point, function (p) {
                    var wp = new Waypoint(p);
                    if (self.debugmode) wp.debug();
                    wp.uid = self.waypoints.length;
                    self.waypoints.push(wp);
                    if (!self.applied) {
                        self.queue.push(wp);
                    };
                });
            }
        },
        // scroll to a certain point
        // accepts and instance of Waypoint, or an integer
        scrollTo: function(waypoint) {
            var self = this;
            if (waypoint instanceof Waypoint) {
                if (waypoint.uid >= this.waypoints.length) return;
                var pos = {
                    y: waypoint.offset.top,
                    x: waypoint.offset.left
                };
            } else {
                pos = waypoint;
            }
            if ( !!~navigator.userAgent.indexOf('Chrome') ) {
                $(document.body).stop().animate({
                    scrollTop: pos.y,
                    scrollLeft: pos.x
                },2000, function(){
                    self.update();
                });
            } else {
                $(document.documentElement).stop().animate({
                    scrollTop: pos.y,
                    scrollLeft: pos.x
                }, 2000, function () {
                    self.update();
                });
            }
        },
        onScroll: function () { },
        onWaypointChanged: function () { },
        onLoad: function () { }
    };

    return new ScrollHooks();

})();
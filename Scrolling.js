// one global instance to report scrolling events
var Scrolling = Scrolling || (function (window, undefined) {
    'use strict';

    var document = window.document;

    // internal useage;

    var scrolling;

    // ====== helper funcs ========

    var help = {

        // apply a function iteratively to a collection (pretty much ripped from jQuery)
        forEach: function (list, fn) {
            var i, l;
            if (list instanceof Array || (list.length !== undefined && typeof list.length === 'number')) {
                for (i = 0, l = list.length; i < l; i++) {
                    if (fn.call(list[i], i, list[i]) === false) {
                        break;
                    }
                }
            } else {
                for (i in list) {
                    if (fn.call(list[i], i, list[i]) === false) {
                        break;
                    }
                }
            }
        },

        // bind an event to an element
        bind: (function () {
            if (window.attachEvent !== undefined) {
                return function (elm, evt, fn) {
                    elm["evt" + evt + fn] = fn;
                    elm[evt + fn] = function () {
                        elm["evt" + evt + fn](window.event);
                    };
                    elm.attachEvent("on" + evt, elm[evt + fn]);
                };
            } else {
                return function (elm, evt, fn) {
                    elm.addEventListener(evt, fn, false);
                };
            }
        }()),

        // Get the offset of an element
        // Returns pixel values from top and left of the root element
        getOffset: function (elm) {
            if (!elm || elm.nodeName === undefined) {
                return { top: 0, left: 0 };
            }
            var leftOffset = 0;
            var topOffset = 0;
            var offsetElm = elm;
            while (offsetElm) {
                leftOffset += offsetElm.offsetLeft;
                topOffset += offsetElm.offsetTop;
                offsetElm = offsetElm.offsetParent;
            }
            return {
                top: topOffset,
                left: leftOffset
            };
        }
    };

    // use document.querySelector, falling back to jQuery
    (function() {
        var qsFunc = function(method, selector, context) {
            var cx;
            if (!selector) {
                throw new Error('No selector provided for help query');
            } else if (typeof selector === 'string') {
                if (typeof context === 'string') {
                    cx = help.queryOne(context);
                } else {
                    cx = context || document;
                }
                return cx[method](selector);
            } else if (typeof selector === 'object' && selector.nodeName !== undefined) {
                return [selector];
            }
        };
        var jqFunc = function(selector, context) {
            return $(selector, (context || null)).toArray();
        };
        var noFunc = function() {
            throw new Error('help query has no power here - please provide jQuery or a newer browser.');
        };
        if (document.querySelectorAll !== undefined) {
            help.query = function (selector, context) {
                return qsFunc('querySelectorAll', selector, context);
            };
            help.queryOne = function (selector, context) {
                return qsFunc('querySelector', selector, context);
            };
        } else if (window.jQuery !== undefined) {
            help.query = function (selector, context) {
                return jqFunc(selector, context);
            };
            help.queryOne = function (selector, context) {
                return jqFunc(selector, context)[0];
            };
        } else {
            help.query = help.queryOne = noFunc;
        }
    }());

    //  ===== private methods =====

    // get current scroll position
    var scrollPositions = (function (docelem) {
        var func1 = function () {
            return { x: window.scrollX, y: window.scrollY };
        };
        var func2 = function () {
            return { x: docelem.scrollLeft, y: docelem.scrollTop };
        };
        return typeof window.scrollY === 'number' ? func1 : func2;
    }(document.documentElement));

    // -- scroll to a certain place in the window - smoothly with jQuery, if available
    var moveTo = (function (hasJquery) {

        // annoying workaround for Chrome
        var eventNode;

        var smooth = function (x, y, callback) {
            eventNode.stop().animate({
                scrollLeft: x,
                scrollTop: y
            }, 2000, callback);
        };
        var snap = function (x, y, callback) {
            window.scrollTo(x, y);
            callback && callback();
        };

        if (hasJquery) {
            eventNode = $(window.navigator.userAgent.indexOf('Chrome') > -1 ? document.body : document.documentElement);
            return smooth;
        } else {
            return snap;
        }

    }(window.jQuery !== undefined));


    // -- try to parse any variable as a DOM node.
    var parseNode = function (arg) {
        var node;
        if (!arg) {
            throw new Error('No good argument was supplied for this element in parseNode.');
        }
        if (typeof arg === 'string') {
            node = help.queryOne(arg);
        } else if (typeof arg === 'function') {
            node = arg();
        } else if (typeof arg === 'object' && arg.nodeName !== undefined) {
            node = arg;
        }
        if (node.nodeName === undefined) {
            throw new Error('No useful DOM node was found in parseNode');
        }
        return node;
    };

    // private Waypoint class
    // takes a DOM node and provides a set of relevant events and values to test against
    var Waypoint = (function () {

        var Waypoint = function (elem) {
            this.domNode = parseNode(elem);
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

                if (this.debugmode) {
                    return;
                }

                this.debugmode = true;
                var x;
                var hex = (Math.floor(Math.random() * 16777215)).toString(16); // can be buggy cross-browser...
                var colour = '#' + hex;
                var output = document.createElement('div');
                var bounds = document.createElement('div');
                var props = { position: 'fixed', zIndex: 99999, background: '#000', color: colour, padding: '1em', font: '12px/1.4em "Consolas", "Courier New", monospace' };
                for (x in props) {
                    output.style[x] = props[x];
                }
                props = { position: 'fixed', background: 'rgba(20,20,20,0.2)', zIndex: 99998, border: '2px solid ' + colour, width: this.width + 'px', height: this.height + 'px', top: '0px', left: '0px' };
                for (x in props) {
                    bounds.style[x] = props[x];
                }
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
                    debug_html += 'Scroll completion: { x: ' + parseInt(this.scrollPercent.x * 100000, 10) / 1000 + '%, ';
                    debug_html += 'y:' + parseInt(this.scrollPercent.y * 100000, 10) / 1000 + '%<br />';
                    debug_html += 'offset: {top: ' + this.offset.top + ', left: ' + this.offset.left + '}<br />';
                    debug_html += 'width: ' + this.width + 'px <br />height: ' + this.height + '<br />';
                    output.innerHTML = debug_html;
                    output.style.top = bounds.style.top = this.position.y + 'px';
                    output.style.left = bounds.style.left = this.position.x + 'px';
                    _onScroll.call(this);
                };
            },

            // setup initial values for the waypoint
            setData: function () {
                this.offset = help.getOffset(this.domNode);
                this.height = this.domNode.clientHeight;
                this.width = this.domNode.clientWidth;
                this.scrollRange = {
                    x: scrolling.viewport.width + this.width,
                    y: scrolling.viewport.height + this.height
                };
            },

            //update all values - this is called by Scrolling.update (bound to window onscroll event)
            update: function () {
                this.position = {
                    x: this.offset.left - scrolling.position.x,
                    y: this.offset.top - scrolling.position.y
                };
                this.scrollPercent = {
                    x: (scrolling.viewport.width - this.position.x) / this.scrollRange.x,
                    y: (scrolling.viewport.height - this.position.y) / this.scrollRange.y
                };
                var wasVisible = this.visible;
                this.isVisible();
                this.onScroll();
                if (this.visible) {
                    this.onVisible.call(this);
                }
                if (this.visible !== wasVisible) {
                    this.onVisibilityChange.call(this);
                    scrolling.onWaypointChanged(this);
                }
            },
            isVisible: function () {
                // vertically visible
                return (this.visible = (this.position.y + this.height > 0 && this.position.y < scrolling.viewport.height
                // horizontally visible
                && this.position.x + this.width >= 0 && this.position.x < scrolling.viewport.width));
            },
            onScroll: function () { },
            onVisible: function () { },
            onVisibilityChange: function () { }
        };
        return Waypoint;
    }());

    var ScrollHooks = function () {

        var self = this;

        // whether it has been applied to the window or not
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

            // bind update to scroll event
            help.bind(window, 'scroll', function () {
                self.update();
            });

            // force initial values
            self.update();
            self.onLoad();
            document.documentElement.className += ' scroll-loaded';
        });

    };

    ScrollHooks.prototype = {
        // display debug info in top right
        debug: function () {
            if (this.debugmode) {
                return;
            }
            this.debugmode = true;
            var i = this.waypoints.length;
            var x;
            var output = document.createElement('div');
            var props = { position: 'fixed', zIndex: 99999, top: '0px', right: '0px', background: '#000', color: '#fff', padding: '1em', font: '12px/1.4em "Consolas", "Courier New", monospace' };
            for (x in props) {
                output.style[x] = props[x];
            }
            document.body.appendChild(output);
            // debug all waypoints
            while (i--) {
                this.waypoints[i].debug();
            }
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
            window.scroll(scrolling.position.x + 1, scrolling.position.y + 1);
            window.scroll(scrolling.position.x - 1, scrolling.position.y - 1);
        },

        // update global positions
        update: function () {
            var oldpos = {
                x: this.position.x,
                y: this.position.y
            };
            this.position = scrollPositions();
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
            while (i--) {
                this.waypoints[i].update();
            }
            this.onScroll.call(this);
        },

        // add waypoints - accepts single HTML Element, iterable collection of HTML elements, or selector
        // returns array of Waypoints
        addWaypoint: function (point) {
            var self = this;
            var points = [];
            if (typeof point === 'string') { // assume css selector
                help.forEach(help.query(point), function (i, p) {
                    var wp = new Waypoint(p);
                    if (self.debugmode) wp.debug();
                    wp.uid = self.waypoints.length;
                    self.waypoints.push(wp);
                    points.push(wp);
                    if (!self.applied) {
                        self.queue.push(wp);
                    };
                });
            } else if ('nodeName' in point) { // assume html element
                var wp = new Waypoint(point);
                if (self.debugmode) wp.debug();
                wp.uid = self.waypoints.length;
                self.waypoints.push(wp);
                points.push(wp);
                if (!self.applied) {
                    self.queue.push(wp);
                };
                return wp;
            } else { // assume collection of elements
                help.forEach(point, function (i, p) {
                    var wp = new Waypoint(p);
                    if (self.debugmode) wp.debug();
                    wp.uid = self.waypoints.length;
                    self.waypoints.push(wp);
                    points.push(wp);
                    if (!self.applied) {
                        self.queue.push(wp);
                    };
                });
            }
            return points;
        },

        // force scroll to a certain point
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
            moveTo(pos.x, pos.y, function () {
                self.update();
            });
        },
        onScroll: function () { },
        onWaypointChanged: function () { },
        onLoad: function () { }
    };

    var scrolling = new ScrollHooks();
    return scrolling;

}(this));
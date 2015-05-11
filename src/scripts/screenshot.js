
(function () {
"use strict";

    /* Modules & Constants */
	
	//ws->
	var DEF_PAGELOAD_TIMEOUT = 60 * 5; //(seconds) timeout of waiting the page's full loading
	//<-ws

    var DEF_ZOOM = 1,
        DEF_QUALITY = 1,
        DEF_DELAY = 100,
        DEF_WIDTH = 1024,
        DEF_HEIGHT = 768,
        DEF_JS_ENABLED = true,
        DEF_IMAGES_ENABLED = true,
        DEF_FORMAT = 'png',
        DEF_HEADERS = {},
        DEF_STYLES = 'body { background: #fff; }';


    /* Common functions */

    function isPhantomJs() {
        return console && console.log;
    }

    function argument(index) {
        var delta = isPhantomJs() ? 1 : 0;
        return system.args[index + delta];
    }

    function log(message) {
        if (isPhantomJs()) {
            console.log(message);
        } else {
            system.stdout.write(message);
        }
    }

    function exit(page, e) {
        if (e) {
            log('Error: ' + e);
        }
        if (page) {
            page.close();
        }
        phantom.exit();
    }

    function def(o, d) {
        return ((o === null) || (typeof (o) === "undefined")) ? d : o;
    }

    function parseOptions(base64) {
        var optionsJSON = window.atob(base64);
        log('Script options: ' + optionsJSON);

        return JSON.parse(optionsJSON);
    }


    /* Web page creation */

    function pageViewPortSize(options) {
        return {
            width: def(options.width, DEF_WIDTH),
            height: def(options.height, DEF_HEIGHT)
        };
    }

    function pageSettings(options) {
        return {
            javascriptEnabled: def(options.js, DEF_JS_ENABLED),
            loadImages: def(options.images, DEF_IMAGES_ENABLED),
            userName: options.user,
            password: options.password,
            userAgent: options.agent
        };
    }

    function pageClipRect(options) {
        var cr = options.clipRect;
        return (cr && cr.top && cr.left && cr.width && cr.height) ? cr : null;
    }

    function pageQuality(options, format) {
        // XXX: Quality parameter doesn't work for PNG files.
        if (format !== 'png') {
            var quality = def(options.quality, DEF_QUALITY);
            return isPhantomJs() ? String(quality * 100) : quality;
        }
        return null;
    }

    function createPage(options) {
        var page = webpage.create(),
            clipRect = pageClipRect(options);

        page.zoomFactor = def(options.zoom, DEF_ZOOM);
        page.customHeaders = def(options.headers, DEF_HEADERS);
        page.viewportSize = pageViewPortSize(options);
        page.settings = pageSettings(options);
        if (clipRect) {
            page.clipRect = clipRect;
        }

        return page;
    }


    /* Screenshot rendering */

    function renderScreenshotFile(page, options, outputFile, onFinish) {
        var delay = def(options.delay, DEF_DELAY),
            format = def(options.format, DEF_FORMAT),
            quality = pageQuality(options, format);

        setTimeout(function () {
            try {
			
				//zcs=>Support dom capture
				if (isPhantomJs() && options.selector) {
					var selector = options.selector;
					//---get the dom's boundary
					var clipRect = page.evaluate(function (sel) {
						try {
							return document.querySelector(sel).getBoundingClientRect();
						} catch (e) {
							return null;
						}
					}, selector);
					if (!clipRect) { throw new Error('Error: Can\'t find selector: ' + selector); }
					page.clipRect = {
						top: clipRect.top,
						left: clipRect.left,
						width: clipRect.width,
						height: clipRect.height
					};
				}
				//<=zcs
				
                page.render(outputFile, {
                    onlyViewport: !!options.height,
                    quality: quality,
                    format: format
                });

                log('Rendered screenshot: ' + outputFile);
                onFinish(page);
            } catch (e) {
                onFinish(page, e);
            }
        }, delay);
    }

    function captureScreenshot(base64, outputFile, onFinish) {
        try {
            var options = parseOptions(base64),
                page = createPage(options);

            page.open(options.url, function (status) {
                if (status !== 'success') {
                    exit();
                } else {
                    try {
						//ws->Wait for all resources are ready
						//page.evaluate(function () { //not work if page takes long time！！！
						//	window.onload = function () { window.manet_page_loaded = 'test'; };
						//});
						// //not work if page takes long time！！！
						//page.evaluateJavaScript('function() { window.onload = function () { window.manet_page_loaded = 1; }; }');
						
						var tryTimes = 0, maxTry = 5 * DEF_PAGELOAD_TIMEOUT; //max try of 300 times(max time waste: 2 * 60000ms=2 * 60s=2min)
						var checkReadyState = function () {
							if (tryTimes >= maxTry) { throw new Error('Timeout occured after tried more times wish to get readyState == complete'); }
							tryTimes ++;
							log('[Wait for onload]: tried ' + tryTimes + ' times');
							setTimeout(function () {
								var readyState = page.evaluate(function () { return document.readyState; });
								//var loaded = page.evaluate(function () { return window.manet_page_loaded; });
								if ('complete' === readyState) {
									addStyles(page, DEF_STYLES);
									renderScreenshotFile(page, options, outputFile, onFinish);
								} else {
									checkReadyState();
								}
							}, 200);
						}
						checkReadyState();
						//<-ws
						
                        // addStyles(page, DEF_STYLES); //ws=
						// renderScreenshotFile(page, options, outputFile, onFinish); //ws=
                    } catch (e) {
                        onFinish(page, e);
                    }
                }
            });
        } catch (e) {
            onFinish(null, e);
        }
    }

    function addStyles(page, styles) {
        page.evaluate(function(styles) {
            var style = document.createElement('style'),
                content = document.createTextNode(styles),
                head = document.head;

            style.setAttribute('type', 'text/css');
            style.appendChild(content);

            head.insertBefore(style, head.firstChild);
        }, styles);
    }

    /* Fire starter */

    var system = require('system'),
        webpage = require('webpage'),
        base64 = argument(0),
        outputFile = argument(1);

    captureScreenshot(base64, outputFile, exit);

})();

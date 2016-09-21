
(function () {
"use strict";
	/* Modules & Constants */
	
	//ws->
	var DEF_PAGELOAD_TIMEOUT = 200; //(毫秒) timeout of waiting the page's full loading
	//<-ws

	var DEF_ZOOM = 1,
		DEF_QUALITY = 1,
		// DEF_DELAY = 100, //Deprecated
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

	//Screenshot rendering（将可能抛出异常）
	function renderScreenshotFile(page, options, outputFile) {
		var format = def(options.format, DEF_FORMAT),
			quality = pageQuality(options, format);

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
	}

	function captureScreenshot(base64, outputFile, onFinish) {
		log('[captureScreenshot]开始执行截图 - START');
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
						
						var tryTimes = 0, maxTry = 10; //增量尝试次数
						var checkReadyState = function () {
							if (tryTimes >= maxTry) { throw new Error('Timeout occured after tried more times wish to get readyState == complete && renderScreenshotFile()'); }
							tryTimes ++;
							log('[Wait for onload]: tried ' + tryTimes + ' times');
							setTimeout(function () {
								var readyState = page.evaluate(function () { return document.readyState; });
								//var loaded = page.evaluate(function () { return window.manet_page_loaded; });
								try {
									if ('complete' != readyState) { throw new Error('页面还未加载完成（readyState=' + readyState + '）'); }
									addStyles(page, DEF_STYLES);
									renderScreenshotFile(page, options, outputFile); //进行截图
									log('[成功]截图成功完成，准备退出 - END');
									onFinish(page); //完成退出
								} catch (e) { //只要报错，就重试
									log('[截图出错]' + e.stack);
									checkReadyState();
								}
							}, DEF_PAGELOAD_TIMEOUT * tryTimes);
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

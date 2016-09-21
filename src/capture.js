"use strict";

var _ = require('lodash'),
    fs = require('fs-extra'),
    logger = require('winston'),
    path = require('path'),
    imagemin = require('imagemin'),
    utils = require('./utils'),
	crypto = require('crypto'),

    SCRIPT_FILE = 'scripts/screenshot.js',

    DEF_ENGINE = 'slimerjs',
    DEF_COMMAND = 'slimerjs',
    DEF_FORMAT = 'png';


/* Configurations and options */

function md5 (data, digest) {
	if (!digest) { digest = 'hex'; } //default printing: normal hex chars
	if (digest === 'buffer') { digest = undefined; }
	if (typeof data === 'string') data = new Buffer(data);
	return crypto.createHash('md5').update(data).digest(digest);
}

function outputFile(options, conf, base64) {
    var format = options.format || DEF_FORMAT;
	//zcs=>The base64's length is too long for a file name, so we should fix the length
	var filename = 'manettemp_' + md5(base64 + '') + '_' + Date.now() + '_' + Math.floor(Math.random() * (999999 - 100000) + 100000);
	//<=zcs
    // return conf.storage + path.sep + base64 + '.' + format; //zcs=old line
	return conf.storage + path.sep + filename + '.' + format;
}

function cliCommand(config) {
    var engine = config.engine || DEF_ENGINE,
        command = config.command || config.commands[engine][process.platform];
    return command || DEF_COMMAND;
}

function cleanupOptions(options, config) {
    var opts = _.omit(options, ['force', 'callback']);
    opts.url = utils.fixUrl(options.url);
    return _.defaults(opts, config.options);
}


/* Image processing */

function minimizeImage(src, dest, cb) {
    var imin = new imagemin()
        .src(src)
        .dest(dest)
        .use(imagemin.jpegtran({progressive: true}))
        .use(imagemin.optipng({optimizationLevel: 3}))
        .use(imagemin.gifsicle({interlaced: true}))
        .use(imagemin.svgo());

    imin.run(function (err) {
        if (err) {
            logger.error(err);
        }
        cb();
    });
}


/* Screenshot capturing runner */

function runCapturingProcess(options, config, outputFile, base64, onFinish) {
    var scriptFile = utils.filePath(SCRIPT_FILE),
        command = cliCommand(config).split(/[ ]+/),
        cmd = _.union(command, [scriptFile, base64, outputFile]),
        opts = {
            timeout: config.timeout
        };

    logger.debug('Options for script: %s, base64: %s', JSON.stringify(options), base64);
    logger.debug('[执行命令行]%s', cmd.join(' '));
    utils.execProcess(cmd, opts, function(code) {
        if (config.compress) {
            minimizeImage(outputFile, config.storage, function() {
                onFinish(code);
            });
        } else {
            onFinish(code);
        }
    });
}


/* External API */

function screenshot(options, config, onFinish) {
    var opts = cleanupOptions(options, config),
        base64 = utils.encodeBase64(opts),
        file = outputFile(opts, config, base64),

        retrieveImageFromStorage = function () {
            logger.debug('Take screenshot from file storage: %s', base64);
            onFinish(file, 0);
        },
        retrieveImageFromSite = function () {
            runCapturingProcess(opts, config, file, base64, function (code) {
                logger.debug('Process finished work: %s', base64);
                return onFinish(file, code);
            });
        };

    logger.info('Capture site screenshot: %s', options.url);

    if (options.force || !config.cache) {
        retrieveImageFromSite();
    } else {
        fs.exists(file, function (exists) {
            if (exists) {
                retrieveImageFromStorage();
            } else {
                retrieveImageFromSite();
            }
        });
    }
}


/* Exported functions */

module.exports = {
    screenshot: screenshot
};

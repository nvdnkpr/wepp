'use strict';

var path = require('path'),
	fs = require('fs'),
	_ = require('underscore'),
	less = require('less'),
	uglify = require('uglify-js'),
	gzipjs = require('gzip-js'),
	cssmin = require('./cssmin'),
	includify = require('./includify'),
	fsExt = require('./fs-ext'),


	defaults = {
		charset: 'utf-8',
		linebreak: -1,
		compress: true,
		stripHeader: false,
		zippedSize: false
	},
	cmdLineUsage = function () {

		var lines = [
			'wepp %BUILD_VERSION%',
			'',
			'Usage:  wepp [Options] --inFile <FILE> --outFile <FILE>',
			'        wepp [Options] --inDir <DIR> --outDir <DIR>',
			'',
			'Options:',
			'    --cs',
			'    --charset',
			'        source and target file encoding',
			'        default: utf-8',
			'',
			'    --lb',
			'    --linebreak',
			'        desired line length in target files',
			'        -1: no line breaks',
			'        default: -1',
			'',
			'    --nc',
			'    --no-compression',
			'        turns off compression',
			'',
			'    --sh',
			'    --strip-header',
			'        strips even header comments in case of compression',
			'',
			'    --zs',
			'    --zipped-size',
			'        also print zipped size of processed files'
		];
		return lines.join('\n');
	},
	message = function (type, message) {
		/*global console */

		if (console) {
			console.log('[wepp:' + type + '] ' + message);
			if (arguments.length > 2) {
				console.log(Array.prototype.slice.call(arguments, 2));
			}
			if (type === 'err') {
				console.log('\n' + cmdLineUsage());
			}
		}
	},
	absFile = function (file) {

		return (file && file[0] !== '/') ? path.join(process.cwd(), file) : file;
	},
	parseArgs = function (args) {

		var arg,
			parsed = {
				options: {},
				inFile: undefined,
				outFile: undefined,
				inDir: undefined,
				outDir: undefined,
				remaining: [],
				errors: []
			};

		args = Array.prototype.slice.call(args);
		while (args.length > 0) {
			arg = args.shift();
			switch (arg) {
				case '--cs':
				case '--charset':
					parsed.options.charset = args.shift();
					break;
				case '--lb':
				case '--linebreak':
					parsed.options.linebreak = parseInt(args.shift(), 10);
					break;
				case '--nc':
				case '--no-compression':
					parsed.options.compress = false;
					break;
				case '--sh':
				case '--strip-header':
					parsed.options.stripHeader = true;
					break;
				case '--zs':
				case '--zipped-size':
					parsed.options.zippedSize = true;
					break;
				case '--in':
				case '--inFile':
					parsed.inFile = absFile(args.shift());
					break;
				case '--out':
				case '--outFile':
					parsed.outFile = absFile(args.shift());
					break;
				case '--inDir':
					parsed.inDir = absFile(args.shift());
					break;
				case '--outDir':
					parsed.outDir = absFile(args.shift());
					break;
				default:
					parsed.remaining.push(arg);
			}
		}

		return parsed;
	},
	getHeaderComment = function (content) {

		return content.match(/^\s*\/\*/) ? content.substr(0, content.indexOf('*/') + 2).trim() + '\n' : '';
	},
	result = function (settings, outFile, content) {

		if (outFile) {
			fsExt.mkdir(path.dirname(outFile), '755');
			fs.writeFileSync(outFile, content, settings.charset);
		} else if (console) {
			console.log(content);
		}
	},
	gzip = function (content) {

		// returns an array of bytes
		return gzipjs.zip(content, {level: 5});
	},
	cssifyLess = function (settings, inFile, content, callback) {

		var parserOpts = {
				paths: [path.dirname(inFile)],
				optimization: 2,
				filename: inFile
			};

		new less.Parser(parserOpts).parse(content, function (err, tree) {
			if (err) {
				less.writeError(err, settings);
			} else {
				try {
					callback(tree.toCSS());
				} catch (e) {
					less.writeError(e, settings);
				}
			}
		});
	},
	minifyCss = function (settings, content) {

		return cssmin(content, settings.linebreak);
	},
	processCss = function (settings, inFile, outFile) {

		var content, header, zipped;

		if (outFile) {
			message('css' + (settings.compress ? '+min' : ''), '\'' + inFile + '\' -> \'' + outFile + '\'');
		}
		content = fs.readFileSync(inFile, settings.charset);
		header = getHeaderComment(content);
		cssifyLess(settings, inFile, content, function (content) {
			if (settings.compress) {
				content = (!settings.stripHeader ? header : '') + minifyCss(settings, content);
			}
			if (settings.zippedSize) {
				zipped = gzip(content);
			}
			message('css' + (settings.compress ? '+min' : '') + ' size', content.length + ' bytes' + (zipped ? ' (gzip: ' + zipped.length + ')' : ''));
			result(settings, outFile, content);
		});
	},
	includifyJs = function (settings, inFile, content) {

		return includify({
			file: inFile,
			content: content,
			charset: settings.charset
		});
	},
	uglifyJs = function (settings, content) {

		return uglify(content);
	},
	processJs = function (settings, inFile, outFile) {

		var content, header, zipped;

		if (outFile) {
			message('js' + (settings.compress ? '+min' : ''), '\'' + inFile + '\' -> \'' + outFile + '\'');
		}
		content = fs.readFileSync(inFile, settings.charset);
		header = getHeaderComment(content);
		content = includifyJs(settings, inFile, content);
		if (settings.compress) {
			content = (!settings.stripHeader ? header : '') + uglifyJs(settings, content);
		}
		if (settings.zippedSize) {
			zipped = gzip(content);
		}
		message('js' + (settings.compress ? '+min' : '') + ' size', content.length + ' bytes' + (zipped ? ' (gzip: ' + zipped.length + ')' : ''));
		result(settings, outFile, content);
	},
	processFile = function (options, inFile, outFile) {

		var settings = _.extend({}, defaults, options),
			ext;

		if (!inFile) {
			message('err', 'input file must be specified');
			return;
		}

		ext = path.extname(inFile);
		if (ext === '.css' || ext === '.less') {
			processCss(settings, inFile, outFile);
		} else if (ext === '.js') {
			processJs(settings, inFile, outFile);
		} else {
			message('err', 'unsupported extension \'' + inFile + '\'');
		}
	},
	processDir = function (options, inDir, outDir) {

		var settings = _.extend({}, defaults, options);

		if (!inDir || !outDir) {
			message('err', 'input and output directory must be specified');
			return;
		}

		fsExt.walk({
			dir: inDir,
			filter: fsExt.filter({
				ext: {
					includes: ['.less', '.css', '.js'],
					excludes: ['.min.js', '.min.css']
				},
				dir: {
					base: inDir,
					includes: [],
					excludes: ['inc', 'lib']
				}
			}),
			callback: function (filepath, stats) {

				var outpath = filepath.replace(new RegExp('^' + inDir), outDir).replace(/\.less$/, '.css');

				processFile(settings, filepath, outpath);
			}
		});
	},
	processArgs = function (args) {

		var parsed = parseArgs(args);

		if (parsed.inFile) {
			processFile(parsed.options, parsed.inFile, parsed.outFile);
		} else if (parsed.inDir) {
			processDir(parsed.options, parsed.inDir, parsed.outDir);
		} else {
			message('err', 'either input file or directory must be specified');
		}
	},


	wepp = {
		processFile: processFile,
		processDir: processDir,
		processArgs: processArgs
	};


module.exports = wepp;

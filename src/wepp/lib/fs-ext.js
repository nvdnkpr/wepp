
(function (global) {
'use strict';
/*jslint confusion: true, node: true, nomen: true, white: true */

    var path = require('path'),
        fs = require('fs'),
        _ = require('underscore'),


        reEscape = function (sequence) {

            return sequence.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, '\\$&');
        },
        mkdir = function (dir, mode) {

            var stats, parent;

            try {
                stats = fs.statSync(dir);
                if (stats.isDirectory()) {
                    return true;
                }
            } catch (err) {}

            try {
                fs.mkdirSync(dir, mode);
                return true;
            } catch (err2) {
                parent = path.dirname(dir);
                if (dir !== parent && mkdir(parent, mode)) {
                    fs.mkdirSync(dir, mode);
                    return true;
                }
            }
            return false;
        },
        walkDir = function (settings, dir, stats) {

            var entries, idx, entry, filepath, fpStats;

            entries = fs.readdirSync(dir);
            _.each(entries, function(entry) {

                filepath = path.join(dir, entry);
                fpStats = fs.statSync(filepath);
                if (settings.filter(filepath, fpStats)) {
                    if (fpStats.isDirectory()) {
                        walkDir(settings, filepath, fpStats);
                    } else {
                        settings.callback(filepath, fpStats);
                    }
                }
            });
        },
        walkDefaults = {
            dir: undefined,
            filter: undefined,
            callback: undefined
        },
        walk = function (options) {

            var settings = _.extend({}, walkDefaults, options);

            walkDir(settings, settings.dir);
        },
        filterDefaults = {
            ext: {
                includes: [],
                excludes: []
            },
            dir: {
                base: undefined,
                includes: [],
                excludes: []
            }
        },
        filter = function (options) {

            var settings = _.extend({}, filterDefaults, options);

            return function (filepath, stats) {

                var i, l, ext, dir;

                if (stats.isFile()) {
                    for (i = 0, l = settings.ext.excludes.length; i < l; i += 1) {
                        ext = settings.ext.excludes[i];
                        if (filepath.match(new RegExp(reEscape(ext) + '$'))) {
                            return false;
                        }
                    }
                    for (i = 0, l = settings.ext.includes.length; i < l; i += 1) {
                        ext = settings.ext.includes[i];
                        if (filepath.match(new RegExp(reEscape(ext) + '$'))) {
                            return true;
                        }
                    }
                    return settings.ext.includes.length === 0;
                } else if (stats.isDirectory()) {
                    for (i = 0, l = settings.dir.excludes.length; i < l; i += 1) {
                        dir = settings.dir.excludes[i];
                        if (filepath === path.join(settings.dir.base, dir)) {
                            return false;
                        }
                    }
                    for (i = 0, l = settings.dir.includes.length; i < l; i += 1) {
                        dir = settings.dir.includes[i];
                        if (filepath === path.join(settings.dir.base, dir)) {
                            return true;
                        }
                    }
                    return settings.dir.includes.length === 0;
                }
            };
        },


        fsExt = {
            mkdir: mkdir,
            walk: walk,
            filter: filter
        };


    if (module) {
        module.exports = fsExt;
    } else {
        global.FSEXT = fsExt;
    }

}(this));

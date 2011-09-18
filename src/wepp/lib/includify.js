(function (global) {
    "use strict";
    /*globals module, console, require, process */

    var path = require('path'),
        fs = require('fs'),
        sys = require('sys'),
        _ = require("underscore"),


        defaults = {
            file: undefined,
            content: undefined,
            charset: "utf-8"
        },
        pattern = /^([ \t]*)\/\/[ \t]*@include[ \t]+(|base:)(["'])(.+)\3[ \t]*$/gm,
        message = function (type, message, stack) {

            if (console) {
                console.log("[includify:" + type + "] " + message);
                if (stack) {
                    console.log("stack", stack);
                }
            }
        },
        recursion = function (settings, stack, file, content) {

            if (_.indexOf(stack, file) >= 0) {
                message("err", "circular reference: '" + file + "'", stack);
                return content;
            }
            stack.push(file);

            content = content.replace(pattern, function (match, indent, mode, quote, reference) {

                var refFile = path.normalize(path.join(path.dirname(file), reference)),
                    refContent;

                try {
                    refContent = fs.readFileSync(refFile, settings.charset);
                    refContent = recursion(settings, stack, refFile, refContent);
                    refContent = indent + refContent.replace(/\n/g, "\n" + indent);
                } catch (err) {
                    refContent = match;
                    message("err", "not found: '" + reference + "' -> '" + refFile + "'", stack);
                }

                return refContent;
            });

            stack.pop();
            return content;
        },
        processOptions = function (options) {

            var file, content,
                settings = _.extend({}, defaults, options);

            if (!settings.file && !settings.content) {
                message("err", "neither file nor content specified");
                return;
            }

            file = settings.file || path.join(process.cwd(), "INPUT");
            content = settings.content || fs.readFileSync(file, settings.charset);
            return recursion(settings, [], file, content);
        },


        includify = processOptions;


    if (module) {
        module.exports = includify;
    } else {
        global.INCLUDIFY = includify;
    }

})(this);

/*!
 * jQuery Taconite plugin - A port of the Taconite framework by Ryan Asleson and
 *     Nathaniel T. Schutta: http://taconite.sourceforge.net/
 *
 * Examples and documentation at: http://malsup.com/jquery/taconite/
 * Copyright (c) 2007-2011 M. Alsup
 * Dual licensed under the MIT and GPL licenses:
 * http://www.opensource.org/licenses/mit-license.php
 * http://www.gnu.org/licenses/gpl.html
 * Thanks to Kenton Simpson for contributing many good ideas!
 *
 * @version: 3.66  02-MAR-2013
 * @requires jQuery v1.3.2 or later
 */

(function($) {
var version = '3.66';

var browser = $.browser;
if ( ! browser ) {
   var ua = navigator.userAgent.toLowerCase();
   var m = /(msie) ([\w.]+)/.exec( ua ) || ! /compatible/.test(ua) && /(mozilla)/.exec( ua ) || [];
   browser = { version: m[2] };
   browser[ m[1] ] = true;
}


$.taconite = function(xml) {
    processDoc(xml);
};

$.taconite.debug = 0;  // set to true to enable debug logging to window.console.log
$.taconite.autodetect = true;
$.taconite.defaults = {
    cdataWrap: 'div'
};

// add 'replace' and 'replaceContent' plugins (conditionally)
$.fn.replace = $.fn.replace || function(a) {
    this.after(a);
    this.remove();
    return this; // #14
};
$.fn.replaceContent = $.fn.replaceContent || function(a) {
    return this.empty().append(a);
};

$.expr[':'].taconiteTag = function(a) {
    return a.taconiteTag === 1;
};

// allow auto-detection to be enabled/disabled on-demand
$.taconite.enableAutoDetection = function(b) {
    $.taconite.autodetect = b;
    if (origHttpData)
        $.httpData = b ? origHttpData : detect;
};

var logCount = 0;
function log() {
    if (!$.taconite.debug || !window.console || !window.console.log) return;
    if (++logCount === 1)
        log('Plugin Version: ' + version);
    window.console.log('[taconite] ' + [].join.call(arguments,''));
}

var parseJSON = $.parseJSON || function(s) {
    /*jshint evil:true */
    return window['eval']('(' + s + ')');
};

function httpData( xhr, type, s ) {
    var ct = xhr.getResponseHeader('content-type') || '',
        xml = type === 'xml' || !type && ct.indexOf('xml') >= 0,
        data = xml ? xhr.responseXML : xhr.responseText;

    if (xml && data.documentElement.nodeName === 'parsererror') {
        if ($.error)
            $.error('parsererror');
    }
    if (s && s.dataFilter) {
        data = s.dataFilter(data, type);
    }
    if (typeof data === 'string') {
        if (type === 'json' || !type && ct.indexOf('json') >= 0) {
            data = parseJSON(data);
        } else if (type === "script" || !type && ct.indexOf("javascript") >= 0) {
            $.globalEval(data);
        }
    }
    return data;
}

function getResponse(xhr, type, s) {
    if (origHttpData)
        return origHttpData(xhr, type, s);
    return xhr.responseXML || xhr.responseText;
}

function detect(xhr, type, s) {
    var ct = xhr.getResponseHeader('content-type');
    if ($.taconite.debug) {
        log('[AJAX response] content-type: ', ct, ';  status: ', xhr.status, ' ', xhr.statusText, ';  has responseXML: ', xhr.responseXML !== null);
        log('type arg: ' + type);
//        log('responseXML: ' + xhr.responseXML);  // IE9 doesn't like xhr.toString()
    }
    var data = getResponse(xhr, type, s);
    if (data && data.documentElement && data.documentElement.nodeName != 'parsererror') {
        $.taconite(data);
    }
    else if (typeof data == 'string') {
        // issue #4 (don't try to parse plain text or html responses
        if ( /taconite/.test(data) )
            $.taconite(data);
    }
    else {
        log('jQuery core httpData returned: ' + data);
        log('httpData: response is not XML (or not "valid" XML)');
    }
    return data;
}

// 1.5+ hook
if ($.ajaxPrefilter) {
    $.ajaxPrefilter(function( options, originalOptions, jqXHR ) {
        jqXHR.success(function( data, status, jqXHR ) {
            if ($.taconite.autodetect)
                detect(jqXHR, options.dataType, options);
        });
    });
}

// < 1.5 hook
var origHttpData = $.httpData;
if ($.httpData)
    $.httpData = detect;  // replace jQuery's httpData method

// custom data parsers
var parsers = { 'json': jsonParser }, rawData, rawDataIndic;

$.taconite.registerParser = function(type, fn) {
    parsers[type] = fn;
};

function parseRawData(type, data) {
    var d = data, parser = parsers[type];
    if ($.isFunction(parser))
        return parser(data);
    else
        throw 'No parser registered for rawData of type "' + type + '"';
}

function jsonParser(json) {
    return parseJSON(json);
}


function processDoc(xml) {
    var status = true, ex;
    try {
        if (typeof xml == 'string')
            xml = convert(xml);
        if (! ( xml && xml.documentElement) ) {
            log('$.taconite invoked without valid document; nothing to process');
            return false;
        }

        var root = xml.documentElement.tagName;
        log('XML document root: ', root);

        var taconiteDoc = $('taconite', xml)[0];

        if (!taconiteDoc) {
            log('document does not contain <taconite> element; nothing to process');
            return false;
        }

        $.event.trigger('taconite-begin-notify', [taconiteDoc]);
        status = go(taconiteDoc);
    } catch(e) {
        status = ex = e;
    }
    if (rawDataIndic)
        $.event.trigger('taconite-rawdata-notify', [rawData]);
    $.event.trigger('taconite-complete-notify', [xml, !!status, status === true ? null : status]);
    if (ex)
        throw ex;
}

// convert string to xml document
function convert(s) {
    var doc;
    log('attempting string to document conversion');
    try {
        if (window.DOMParser) {
            var parser = new DOMParser();
            doc = parser.parseFromString(s, 'text/xml');
        }
        else {
            doc = $("<xml>")[0];
            doc.async = 'false';
            doc.loadXML(s);
        }
    }
    catch(e) {
        if (window.console && window.console.error)
            window.console.error('[taconite] ERROR parsing XML string for conversion: ' + e);
        throw e;
    }
    var ok = doc && doc.documentElement && doc.documentElement.tagName != 'parsererror';
    log('conversion ', ok ? 'successful!' : 'FAILED');
    return doc;
}

function go(xml) {
    try {
        var t = new Date().getTime();
        // process the document
        process(xml.childNodes);
        $.taconite.lastTime = (new Date().getTime()) - t;
        log('time to process response: ' + $.taconite.lastTime + 'ms');
    } catch(e) {
        if (window.console && window.console.error)
            window.console.error('[taconite] ERROR processing document: ' + e);
        throw e;
    }
    return true;
}

// process the taconite commands
function process(commands) {
    rawData = {};
    rawDataIndic = false;
    var trimHash = { wrap: 1 };
    var doPostProcess = 0;
    var a, n, v, i, j, js, els, raw, type, q, jq, cdataWrap, tmp;

    for(i=0; i < commands.length; i++) {
        if (commands[i].nodeType != 1)
            continue; // commands are elements
        var cmdNode = commands[i], cmd = cmdNode.tagName;
        if (cmd == 'eval') {
            js = (cmdNode.firstChild ? cmdNode.firstChild.nodeValue : null);
            log('invoking "eval" command: ', js);
            if (js)
                $.globalEval(js);
            continue;
        }
        if (cmd == 'rawData') {
            raw = (cmdNode.firstChild ? cmdNode.firstChild.nodeValue : null);
            type = cmdNode.getAttribute('type');
            log('rawData ('+type+'): ', raw);

            var namespace = cmdNode.getAttribute('namespace') || 'none';

            if (!rawData[namespace])
                rawData[namespace] = [];

            rawData[namespace].push({
                data: parseRawData(type, raw),
                type: type,
                name: cmdNode.getAttribute('name') || null,
                raw: raw
            });
            if (!rawDataIndic)
                rawDataIndic = true;
            continue;
        }
        q = cmdNode.getAttribute('select');
        jq = $(q);
        if (!jq[0]) {
            log('No matching targets for selector: ', q);
            continue;
        }
        cdataWrap = cmdNode.getAttribute('cdataWrap') || $.taconite.defaults.cdataWrap;

        a = [];
        if (cmdNode.childNodes.length > 0) {
            doPostProcess = 1;
            for (j=0,els=[]; j < cmdNode.childNodes.length; j++)
                els[j] = createNode(cmdNode.childNodes[j], cdataWrap);
            a.push(trimHash[cmd] ? cleanse(els) : els);
        }

        // remain backward compat with pre 2.0.9 versions
        n = cmdNode.getAttribute('name');
        v = cmdNode.getAttribute('value');
        if (n !== null) 
            a.push(n);
        if (v !== null) {
            tmp = Number(v);
            if (v == tmp)
                v = tmp;
            a.push(v);
        }

        // @since: 2.0.9: support arg1, arg2, arg3...
        for (j=1; true; j++) {
            v = cmdNode.getAttribute('arg'+j);
            if (v === null)
                break;
            // support numeric primitives
            if (v.length) {
                tmp = Number(v);
                if (v == tmp)
                    v = tmp;
            }
            a.push(v);
        }

        if ($.taconite.debug)
            logCommand(q, cmd, a, els);
        jq[cmd].apply(jq,a);
    }

    // apply dynamic fixes
    if (doPostProcess)
        postProcess();
}

function logCommand(q, cmd, a, els) {
    var args = '...';
    if (!els) {
        args = '';
        for (var k=0; k < a.length; k++) {
            val=a[k];
            if (k > 0)
                args += ',';
            if (typeof val == 'string')
                args += ("'" + val + "'");
            else
                args += val;
        }
    }
    log("invoking command: $('", q, "').", cmd, '('+ args +')');
}

function postProcess() {
    if (browser.mozilla) return;
    // post processing fixes go here; currently there is only one:
    // fix1: opera, IE6, Safari/Win don't maintain selected options in all cases (thanks to Karel Fučík for this!)
    $('select:taconiteTag').each(function() {
        var sel = this;
        $('option:taconiteTag', this).each(function() {
            this.setAttribute('selected','selected');
            this.taconiteTag = null;
            if (sel.type == 'select-one') {
                var idx = $('option',sel).index(this);
                sel.selectedIndex = idx;
            }
        });
        this.taconiteTag = null;
    });
}

function cleanse(els) {
    for (var i=0, a=[]; i < els.length; i++)
        if (els[i].nodeType == 1) a.push(els[i]);
    return a;
}

function createNode(node, cdataWrap) {
    var type = node.nodeType;
    if (type == 1) return createElement(node, cdataWrap);
    if (type == 3) return fixTextNode(node.nodeValue);
    if (type == 4) return handleCDATA(node.nodeValue, cdataWrap);
    return null;
}

function handleCDATA(s, cdataWrap) {
    var el = document.createElement(cdataWrap);
    var $el = $(el)[cdataWrap == 'script' ? 'text' : 'html'](s);
    var $ch = $el.children();

    // remove wrapper node if possible
    if ($ch.size() == 1)
        return $ch[0];
    return el;
}

function fixTextNode(s) {
    if (browser.msie) 
        s = s.replace(/\n/g, '\r').replace(/\s+/g, ' ');
    return document.createTextNode(s);
}

function createElement(node, cdataWrap) {
    var e, tag = node.tagName.toLowerCase();
    // some elements in IE need to be created with attrs inline
    if (browser.msie && browser.version < 9) {
        var type = node.getAttribute('type');
        if (tag == 'table' || type == 'radio' || type == 'checkbox' || tag == 'button' ||
            (tag == 'select' && node.getAttribute('multiple'))) {
            e = document.createElement('<' + tag + ' ' + copyAttrs(null, node, true) + '>');
        }
    }
    if (!e) {
        e = document.createElement(tag);
        copyAttrs(e, node);
    }

    // IE fix; colspan must be explicitly set
    if (browser.msie && tag == 'td') {
        var colspan = node.getAttribute('colspan');
        if (colspan) 
            e.colSpan = parseInt(colspan, 10);
    }

    // IE fix; script tag not allowed to have children
    if(browser.msie && !e.canHaveChildren) {
        if(node.childNodes.length > 0)
            e.text = node.text;
    }
    else {
        for(var i=0, max=node.childNodes.length; i < max; i++) {
            var child = createNode (node.childNodes[i], cdataWrap);
            if(child) e.appendChild(child);
        }
    }
    if (! browser.mozilla) {
        if (tag == 'select' || (tag == 'option' && node.getAttribute('selected')))
            e.taconiteTag = 1;
    }
    return e;
}

function copyAttrs(dest, src, inline) {
    for (var i=0, attr=''; i < src.attributes.length; i++) {
        var a = src.attributes[i], n = $.trim(a.name), v = $.trim(a.value);
        if (inline) attr += (n + '="' + v + '" ');
        else if (n == 'style') { // IE workaround
            dest.style.cssText = v;
            dest.setAttribute(n, v);
        }
        else $.attr(dest, n, v);
    }
    return attr;
}

})(jQuery);

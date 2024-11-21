// SPDX-FileCopyrightText: 2023 XWiki CryptPad Team <contact@cryptpad.org> and contributors
//
// SPDX-License-Identifier: AGPL-3.0-or-later

define([
    'jquery',
    '/common/common-util.js',
    '/common/diffMarked.js',
    '/common/hyperscript.js',
    '/components/hyper-json/hyperjson.js',
    '/components/nthen/index.js',
    '/lib/turndown.browser.umd.js'
], function ($, Util, DiffMd, h, Hyperjson, nThen, Turndown) {
    var module = {
        ext: '.html', // default
        exts: ['.html', '.md', '.doc']
    };

    module.importMd = function (md, common) {
        var html = DiffMd.render(md, true, false, true);
        var div = h('div#cp-temp');
        DiffMd.apply(html, $(div), common);
        var body = h('body');
        body.innerHTML = div.innerHTML;
        return body;
    };

    var exportMediaTags = function (inner, cb) {
        var $clone = $(inner).clone();
        nThen(function (waitFor) {
            $(inner).find('media-tag').each(function (i, el) {
                var blob = Util.find(el, ['_mediaObject','_blob', 'content']);
                if (!blob) { return; }
                Util.blobToImage(blob, waitFor(function (imgSrc) {
                    $clone.find('media-tag[src="' + $(el).attr('src') + '"] img')
                        .attr('src', imgSrc);
                    $clone.find('media-tag').parent()
                        .find('.cke_widget_drag_handler_container').remove();
                }));
            });
        }).nThen(function () {
            cb($clone[0]);
        });
    };

    var cleanHtml = function (inner) {
        return inner.innerHTML.replace(/<img[^>]*class="cke_anchor"[^>]*data-cke-realelement="([^"]*)"[^>]*>/g,
                function(match,realElt){
                    //console.log("returning realElt \"" + unescape(realElt)+ "\".");
                    return decodeURIComponent(realElt);
                });
    };
    module.getHTML = function (inner) {
        return ('<!DOCTYPE html>\n' + '<html>\n' +
                '  <head><meta charset="utf-8"></head>\n  <body>' +
                cleanHtml(inner) +
            '  </body>\n</html>'
        );
    };

    var exportDoc = function (inner) {
        var preHtml = "<html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'><head><meta charset='utf-8'><title>Export HTML To Doc</title></head><body>";
        var postHtml = "</body></html>";
        var _html = preHtml+cleanHtml(inner)+postHtml;
        return _html;
    };

    module.main = function (userDoc, cb, ext) {
        if (!ext || module.exts.indexOf(ext) === -1) { ext = module.ext; }

        var inner;
        if (userDoc && userDoc.tagName) {
            inner = userDoc;
        } else {
            try {
                if (Array.isArray(userDoc)) {
                    inner = Hyperjson.toDOM(userDoc);
                } else {
                    console.error('This Pad is not an array!', userDoc);
                    return void cb('');
                }
            } catch (e) {
                console.log(JSON.stringify(userDoc));
                console.error(userDoc);
                console.error(e);
                return void cb('');
            }
        }
        exportMediaTags(inner, function (toExport) {
            if (ext === ".doc") {
                var blob = new Blob(['\ufeff', exportDoc(toExport)], {
                    type: 'application/msword'
                });
                return void cb(blob);
            }
            if (ext === ".md") {
                var md = Turndown({
                    headingStyle: 'atx'
                }).addRule('table', {
                filter: ['tr'],
                replacement: function (content, node) {
                    var indexOf = Array.prototype.indexOf;
                    var index = indexOf.call(node.parentNode.childNodes, node);
                    var rowContent = node.innerHTML.replace(/<td>|<\/td>/g, '').split('<br>')
                    rowContent[0] = `|${rowContent[0]}`
                    var row = ''
                    var rowLength = rowContent.filter(Boolean).length
                    for (var i =0; i < rowLength; i++) {
                        var cell = rowContent[i]
                        cell += ' |'
                        row += cell
                    }                    
                    var newRow = row.concat('\n')
                    if (index === 0) {
                        var separator = '|-'
                        newRow += `${separator.repeat(rowLength)}\n`
                    }
                    return newRow
                }})
                .turndown(toExport);
                console.log(md)
                var mdBlob = new Blob([md], {
                    type: 'text/markdown;charset=utf-8'
                });
                return void cb(mdBlob);
            }
            var html = module.getHTML(toExport);
            cb(new Blob([ html ], { type: "text/html;charset=utf-8" }));
        });
    };

    return module;
});

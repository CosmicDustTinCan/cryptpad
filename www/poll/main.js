// SPDX-FileCopyrightText: 2023 XWiki CryptPad Team <contact@cryptpad.org> and contributors
//
// SPDX-License-Identifier: AGPL-3.0-or-later

// Load #1, load as little as possible because we are in a race to get the loading screen up.
define([
    '/components/nthen/index.js',
    '/api/config',
    '/common/dom-ready.js',
    '/common/sframe-common-outer.js',
], function (nThen, ApiConfig, DomReady, SFCommonO) {

    // Loaded in load #2
    var hash, href;
    nThen(function (waitFor) {
        DomReady.onReady(waitFor());
    }).nThen(function (waitFor) {
        var obj = SFCommonO.initIframe(waitFor, true);
        href = obj.href;
        hash = obj.hash;
        if (!hash) {
            window.location.href = '/form/';
            waitFor.abort();
        }
    }).nThen(function (/*waitFor*/) {
        SFCommonO.start({
            hash: hash,
            href: href,
            useCreationScreen: true,
            messaging: true
        });
    });
});

// SPDX-FileCopyrightText: 2023 XWiki CryptPad Team <contact@cryptpad.org> and contributors
//
// SPDX-License-Identifier: AGPL-3.0-or-later

define([
    'jquery',
    '/common/toolbar.js',
    '/components/nthen/index.js',
    '/common/sframe-common.js',
    '/common/common-interface.js',
    '/common/common-ui-elements.js',
    '/common/common-util.js',
    '/common/common-hash.js',
    '/common/inner/sidebar-layout.js',
    '/customize/messages.js',
    '/common/common-signing-keys.js',
    '/common/hyperscript.js',
    '/common/clipboard.js',
    '/customize/application_config.js',
    '/api/config',

    'css!/components/bootstrap/dist/css/bootstrap.min.css',
    'css!/components/components-font-awesome/css/font-awesome.min.css',
    'less!/newadmin/app-admin.less',
], function(
    $,
    Toolbar,
    nThen,
    SFCommon,
    UI,
    UIElements,
    Util,
    Hash,
    Sidebar,
    Messages,
    h,
    Keys,
    Clipboard,
    AppConfig,
    ApiConfig,
) {
    var APP = window.APP = {};

    var common;
    var metadataMgr;
    var privateData;
    var sFrameChan;

    var flushCacheNotice = function () {
        var notice = UIElements.setHTML(h('p'), Messages.admin_reviewCheckupNotice);
        $(notice).find('a').attr({
            href: new URL('/checkup/', ApiConfig.httpUnsafeOrigin).href,
        }).click(function (ev) {
            ev.preventDefault();
            ev.stopPropagation();
            common.openURL('/checkup/');
        });
        var content = h('span', [
            UIElements.setHTML(h('p'), Messages.admin_cacheEvictionRequired),
            notice,
        ]);
        UI.alert(content);
    };

    var andThen = function (common, $container) {
        const sidebar = Sidebar.create(common, 'admin', $container);
        var categories = {
            'general': {
                icon: 'fa fa-user-o',
                content: [
                    'flush-cache',
                    'update-limit',
                    'enableembeds',
                    'forcemfa',
                    'email',

                    'instance-info-notice',

                    'name',
                    'description',
                    'jurisdiction',
                    'notice',
                ]
            },
            'users' : {
                icon : 'fa fa-address-card-o',
                content : [
                'registration',
                'invitation',
                'users'
                ]
            },
            'quota': {
                icon: 'fa fa-hdd-o',
                content: [
                    'defaultlimit',
                    'setlimit',
                    'getlimits',
                ]
            },
            'database' : {
                icon : 'fa fa-database',
                content : [
                    'account-metadata',
                    'document-metadata',
                    'block-metadata',
                    'totp-recovery',

                ]
            },
            'stats' : {
                icon : 'fa fa-line-chart',
                content : [
                    'refresh-stats',
                    'uptime',
                    'active-sessions',
                    'active-pads',
                    'open-files',
                    'registered',
                    'disk-usage',
                ]
            },
            'support' : {
                icon : 'fa fa-life-ring',
                content : [
                    'support-list',
                    'support-init',
                    'support-priv',
                ]
            },
            'broadcast' : {
                icon: 'fa fa-bullhorn',
                content : [
                    'maintenance',
                    'survey',
                    'broadcast',
                ]
            },
            'performance' : {
                icon : 'fa fa-heartbeat',
                content : [
                    'refresh-performance',
                    'performance-profiling',
                    'enable-disk-measurements',
                    'bytes-written',
                ]
            },
            'network' : {
                icon : 'fa fa-sitemap',
                content : [
                    'update-available',
                    'checkup',
                    'block-daily-check',
                    'provide-aggregate-statistics',
                    'list-my-instance',

                    'consent-to-contact',
                    'remove-donate-button',
                    'instance-purpose',
                ]
            }
        };
        const blocks = sidebar.blocks;
        var makeAdminCheckbox = function (config) {
            return function () { 
                var state = config.getState();
                var key = config.key;
              
                sidebar.addItem(key, function (cb) {
                    var labelKey = 'admin_' + keyToCamlCase(key) + 'Label';
                    var titleKey = 'admin_' + keyToCamlCase(key) + 'Title';
                    var label = Messages[labelKey] || Messages[titleKey];
                    var box = blocks.checkbox({
                        key: key,
                        label: label,
                        state: state,
                        opts: { spinner: true }
                    });
                    var $cbox = $(box);
                    var spinner = box.spinner;
                    var $checkbox = $cbox.find('input').on('change', function() {
                        spinner.spin();
                        var val = $checkbox.is(':checked') || false;
                        $checkbox.attr('disabled', 'disabled');
                        config.query(val, function (state) {
                            spinner.done();
                            $checkbox[0].checked = state;
                            $checkbox.removeAttr('disabled');
                        });  
                    });  
                    cb(box);
                });
            };
        };
        
        //general blocks
        sidebar.addItem('flush-cache', function (cb) {
            var button = blocks.button('primary', '', Messages.admin_flushCacheButton);
            var called = false;
            Util.onClickEnter($(button), function () {
                if (called) { return; }
                called = true;
                sFrameChan.query('Q_ADMIN_RPC', {
                    cmd: 'FLUSH_CACHE',
                }, function (e, data) {
                    called = false;
                    UI.alert(data ? Messages.admin_flushCacheDone || 'done' : 'error' + e);
                });
            });
            cb(button);
        });

        sidebar.addItem('update-limit', function (cb) {
            var button = blocks.button('primary', '',  Messages.admin_updateLimitButton);
            var called = false;
            Util.onClickEnter($(button), function () {
                if (called) { return; }
                called = true;
                sFrameChan.query('Q_ADMIN_RPC', {
                    cmd: 'Q_UPDATE_LIMIT',
                }, function (e, data) {
                    called = false;
                    UI.alert(data ? Messages.admin_updateLimitDone  || 'done' : 'error' + e);
                });
            });
            cb(button);
        });

        //enableembedss
        sidebar.addCheckboxItem({
            key: 'enableembeds',
            getState: function () {
                return APP.instanceStatus.enableEmbedding;
            },
            query: function (val, setState) {
                sFrameChan.query('Q_ADMIN_RPC', {
                    cmd: 'ADMIN_DECREE',
                    data: ['ENABLE_EMBEDDING', [val]]
                }, function (e, response) {
                    if (e || response.error) {
                        UI.warn(Messages.error);
                        console.error(e, response);
                    }
                    APP.updateStatus(function () {
                        setState(APP.instanceStatus.enableEmbedding);
                        flushCacheNotice();
                    });
                });
            },
        });

        //2fa
        sidebar.addCheckboxItem({
            key: 'forcemfa',
            getState: function () {
                return APP.instanceStatus.enforceMFA;
            },
            query: function (val, setState) {
                sFrameChan.query('Q_ADMIN_RPC', {
                    cmd: 'ADMIN_DECREE',
                    data: ['ENFORCE_MFA', [val]]
                }, function (e, response) {
                    if (e || response.error) {
                        UI.warn(Messages.error);
                        console.error(e, response);
                    }
                    APP.updateStatus(function () {
                        setState(APP.instanceStatus.enforceMFA);
                        flushCacheNotice();
                    });
                });
            },
        });

       
        var getInstanceString = function (attr) {
            var val = APP.instanceStatus[attr];
            var type = typeof(val);
            switch (type) {
                case 'string': 
                    return val || '';
                case 'object': 
                    return val.default || '';
                default: 
                    return '';
            }
        };
        
        //admin email
        sidebar.addItem('email', function (cb){

            var button = blocks.clickableButton('primary', '', Messages.settings_save, function (done) {
                sFrameChan.query('Q_ADMIN_RPC', {
                    cmd: 'ADMIN_DECREE',
                    data: ['SET_ADMIN_EMAIL', [$input.val().trim()]]
                }, function (e, response) {
                    if (e || response.error) {
                        UI.warn(Messages.error);
                        $input.val('');
                        console.error(e, response);
                        done(false);
                        return;
                    }
                    done(true);
                    UI.log(Messages._getKey('ui_saved', [Messages.admin_emailTitle]));
                });
            });
            
            var $button = $(button);
            var nav = blocks.nav([button]);

            var input = blocks.input({
                type: 'email',
                value: ApiConfig.adminEmail || '',
                'aria-labelledby': 'cp-admin-email'
            });
            var $input = $(input);

            var form = blocks.form([
                input,
            ], nav); 

            $(nav).append(button.spinner);

            cb(form);
        });

        //info notice
        sidebar.addItem('instance-info-notice', function(cb){
            var key = 'instance-info-notice';
            var notice = blocks.alert( 'info', key, [Messages.admin_infoNotice1, ' ', Messages.admin_infoNotice2]);
            cb(notice);
        },  { 
            noTitle: true,
            noHint: true
        });
        //instance name
        sidebar.addItem('name', function (cb){

            var button = blocks.clickableButton('primary', '', Messages.settings_save, function (done) {
                sFrameChan.query('Q_ADMIN_RPC', {
                    cmd: 'ADMIN_DECREE',
                    data: ['SET_INSTANCE_NAME', [$input.val().trim()]]
                }, function (e, response) {
                    if (e || response.error) {
                        UI.warn(Messages.error);
                        $input.val('');
                        console.error(e, response);
                        done(false);
                        return;
                    }
                    done(true);
                    UI.log(Messages._getKey('ui_saved', [Messages.admin_nameTitle]));
                });
            });
            
            var $button = $(button);
            var nav = blocks.nav([button]);

            var input = blocks.input({
                type: 'text',
                value: getInstanceString('instanceName')|| ApiConfig.httpUnsafeOrigin || '',
                placeholder: ApiConfig.httpUnsafeOrigin,
                'aria-labelledby': 'cp-admin-name'
            });
            var $input = $(input);

            var form = blocks.form([
                input,
            ], nav); 

            $(nav).append(button.spinner);

            cb(form);
        });

        //instance description
        sidebar.addItem('description', function (cb){

            var button = blocks.clickableButton('primary', '', Messages.settings_save, function (done) {
                sFrameChan.query('Q_ADMIN_RPC', {
                    cmd: 'ADMIN_DECREE',
                    data: ['SET_INSTANCE_DESCRIPTION', [$input.val().trim()]]
                }, function (e, response) {
                    if (e || response.error) {
                        UI.warn(Messages.error);
                        $input.val('');
                        console.error(e, response);
                        done(false);
                        return;
                    }
                    done(true);
                    UI.log(Messages._getKey('ui_saved', [Messages.admin_descriptionTitle]));
                });
            });
            
            var $button = $(button);
            var nav = blocks.nav([button]);

            var input = blocks.input({
                type: 'text',
                value: getInstanceString('instanceDescription'),
                placeholder: '',
                'aria-labelledby': 'cp-admin-description'
            });
            var $input = $(input);

            var form = blocks.form([
                input,
            ], nav); 

            $(nav).append(button.spinner);

            cb(form);
        });

        sidebar.addItem('jurisdiction', function (cb){

            var button = blocks.clickableButton('primary', '', Messages.settings_save, function (done) {
                sFrameChan.query('Q_ADMIN_RPC', {
                    cmd: 'ADMIN_DECREE',
                    data: ['SET_INSTANCE_JURISDICTION', [$input.val().trim()]]
                }, function (e, response) {
                    if (e || response.error) {
                        UI.warn(Messages.error);
                        $input.val('');
                        console.error(e, response);
                        done(false);
                        return;
                    }
                    done(true);
                    UI.log(Messages._getKey('ui_saved', [Messages.admin_jurisdictionTitle]));
                });
            });
            
            var $button = $(button);
            var nav = blocks.nav([button]);

            var input = blocks.input({
                type: 'text',
                value: getInstanceString('instanceJurisdiction'),
                placeholder: '',
                'aria-labelledby': 'cp-admin-jurisdiction'
            });
            var $input = $(input);

            var form = blocks.form([
                input,
            ], nav); 

            $(nav).append(button.spinner);

            cb(form);
        });

        sidebar.addItem('notice', function (cb){

            var button = blocks.clickableButton('primary', '', Messages.settings_save, function (done) {
                sFrameChan.query('Q_ADMIN_RPC', {
                    cmd: 'ADMIN_DECREE',
                    data: ['SET_INSTANCE_NOTICE', [$input.val().trim()]]
                }, function (e, response) {
                    if (e || response.error) {
                        UI.warn(Messages.error);
                        $input.val('');
                        console.error(e, response);
                        done(false);
                        return;
                    }
                    done(true);
                    UI.log(Messages._getKey('ui_saved', [Messages.admin_noticeTitle]));
                });
            });
            
            var $button = $(button);
            var nav = blocks.nav([button]);

            var input = blocks.input({
                type: 'text',
                value: getInstanceString('instanceNotice'),
                placeholder: '',
                'aria-labelledby': 'cp-admin-notice'
            });
            var $input = $(input);

            var form = blocks.form([
                input,
            ], nav); 

            $(nav).append(button.spinner);

            cb(form);
        });

        var getPrettySize = UIElements.prettySize;
         //user blocks
         //to determine functionilty for both sso reg and simpple one
            sidebar.addCheckboxItem({
                key: 'registration',
                getState: function () {
                    return APP.instanceStatus.restrictRegistration;
                },
                query: function (val, setState) {
                    sFrameChan.query('Q_ADMIN_RPC', {
                        cmd: 'ADMIN_DECREE',
                        data: ['RESTRICT_REGISTRATION', [val]]
                    }, function (e, response) {
                        if (e || response.error) {
                            UI.warn(Messages.error);
                            console.error(e, response);
                        }
                        APP.updateStatus(function () {
                            setState(APP.instanceStatus.restrictRegistration);
                            refresh();
                            flushCacheNotice();
                        });
                    });
                },
            });
        
        var ssoEnabled = ApiConfig.sso && ApiConfig.sso.list && ApiConfig.sso.list.length;

        sidebar.addCheckboxItem({
            key: 'registration',
            getState: function () {
                return APP.instanceStatus.restrictRegistration;
            },
            query: function (val, setState) {
                sFrameChan.query('Q_ADMIN_RPC', {
                    cmd: 'ADMIN_DECREE',
                    data: ['RESTRICT_REGISTRATION', [val]]
                }, function (e, response) {
                    if (e || response.error) {
                        UI.warn(Messages.error);
                        console.error(e, response);
                    }
                    APP.updateStatus(function () {
                        setState(APP.instanceStatus.restrictRegistration);
                        flushCacheNotice();
                    });
                });
            },
        });

        if (ssoEnabled) {
            sidebar.addCheckboxItem({
                key: 'registration-sso',
                getState: function () {
                    return APP.instanceStatus.restrictSsoRegistration;
                },
                query: function (val, setState) {
                    sFrameChan.query('Q_ADMIN_RPC', {
                        cmd: 'ADMIN_DECREE',
                        data: ['RESTRICT_SSO_REGISTRATION', [val]]
                    }, function (e, response) {
                        if (e || response.error) {
                            UI.warn(Messages.error);
                            console.error(e, response);
                        }
                        APP.updateStatus(function () {
                            setState(APP.instanceStatus.restrictSsoRegistration);
                            flushCacheNotice();
                        });
                    });
                },
            });
        }

        //invitation
        sidebar.addItem('invitation', function(cb){
            var button = blocks.button('primary', '', Messages.admin_invitationCreate);
            var $b = $(button);

            var inputAlias = blocks.input({
                type: 'text'
            });
            var blockAlias = blocks.labelledInput(Messages.admin_invitationAlias, inputAlias);

            var inputEmail = blocks.input({
                type: 'email'
            });
            var blockEmail = blocks.labelledInput(Messages.admin_invitationEmail, inputEmail);

            var refreshInvite = function () {};
            var refreshButton = blocks.button('secondary', '', Messages.oo_refresh);
            Util.onClickEnter($(refreshButton), function () {
                refreshInvite();
            });
        
            var header = [
                Messages.admin_invitationLink,
                Messages.admin_invitationAlias,
                Messages.admin_invitationEmail,
                Messages.admin_documentCreationTime,
                ""
            ];
            var list = blocks.table(header, []);
            var $list = $(list);
            
            var nav = blocks.nav([button, refreshButton]);
            var form = blocks.form([
                blockAlias,
                blockEmail,
                list
            ], nav);
        
            var metadataMgr = common.getMetadataMgr();
            var privateData = metadataMgr.getPrivateData();
        
            var deleteInvite = function (id) {
                sFrameChan.query('Q_ADMIN_RPC', {
                    cmd: 'DELETE_INVITATION',
                    data: id
                }, function (e, response) {
                    $b.prop('disabled', false);
                    if (e || response.error) {
                        UI.warn(Messages.error);
                        return void console.error(e, response);
                    }
                    refreshInvite();
                });
            };
        
            refreshInvite = function () {
                sFrameChan.query('Q_ADMIN_RPC', {
                    cmd: 'GET_ALL_INVITATIONS',
                }, function (e, response) {
                    if (e || response.error) {
                        if (!response || response.error !== "ENOENT") { UI.warn(Messages.error); }
                        console.error(e, response);
                        return;
                    }
                    if (!Array.isArray(response)) { return; }
                    var all = response[0];
                    var newEntries = [];
                    Object.keys(all).forEach(function (key) {
                        var data = all[key];
                        var url = privateData.origin + Hash.hashToHref(key, 'register');
              
                        var del = blocks.button('danger', 'fa fa-trash', Messages.kanban_delete )
                        var $del = $(del);
                        Util.onClickEnter($del, function () {
                            $del.attr('disabled', 'disabled');
                            UI.confirm(Messages.admin_invitationDeleteConfirm, function (yes) {
                                $del.attr('disabled', '');
                                if (!yes) { return; }
                                deleteInvite(key);
                            });
                        });
                        var copy = blocks.button('secondary', 'fa fa-clipboard', Messages.admin_invitationCopy )
                        Util.onClickEnter($(copy), function () {
                            Clipboard.copy(url, () => {
                                UI.log(Messages.genericCopySuccess);
                            });
                        });
                        
                        newEntries.push([
                            UI.dialog.selectable(url),
                            data.alias,
                            data.email,
                            new Date(data.time).toLocaleString(),
                            [copy, del]
                        ]);
                    });
                    list.updateContent(newEntries);  
                    
                });
               
            };
            refreshInvite();
        
            $b.on('click', () => {
                var alias = $(inputAlias).val().trim();
                if (!alias) { return void UI.warn(Messages.error); } // FIXME better error message
                $b.prop('disabled', true);
                sFrameChan.query('Q_ADMIN_RPC', {
                    cmd: 'CREATE_INVITATION',
                    data: {
                        alias,
                        email: $(inputEmail).val()
                    }
                }, function (e, response) {
                    $b.prop('disabled', false);
                    if (e || response.error) {
                        UI.warn(Messages.error);
                        return void console.error(e, response);
                    }
                    $(inputAlias).val('').focus();
                    $(inputEmail).val('');
                    refreshInvite();
                });
            });
        
            cb(form);
        });
        
        //user directory

        Keys.canonicalize = function (input) {
            if (typeof(input) !== 'string') { return; }
            // key is already in simple form. ensure that it is an 'unsafeKey'
            if (input.length === 44) {
                return unescape(input);
            }
            try {
                return Keys.parseUser(input).pubkey;
            } catch (err) {
                return;
            }
    };
    
   
    
       sidebar.addItem('users', function(cb){

        var $invited = blocks.checkbox('store-invited', Messages.admin_storeInvited, !APP.instanceStatus.dontStoreInvitedUsers, {}, function(checked) {
            sFrameChan.query('Q_ADMIN_RPC', {
                cmd: 'ADMIN_DECREE',
                data: ['DISABLE_STORE_INVITED_USERS', [!checked]]
            }, function (e, response) {
                if (e || response.error) {
                    UI.warn(Messages.error);
                    console.error(e, response);
                }
                APP.updateStatus(function () {
                    $invited.prop('checked', !APP.instanceStatus.dontStoreInvitedUsers);
                    flushCacheNotice();
                });
            });
        });
        var ssoEnabled = ApiConfig.sso && ApiConfig.sso.list && ApiConfig.sso.list.length;
        if(ssoEnabled){
            var $sso = blocks.checkbox('store-sso', Messages.admin_storeInvited, !APP.instanceStatus.dontStoreSSOUsers, {}, function(checked) {
    
                    sFrameChan.query('Q_ADMIN_RPC', {
                        cmd: 'ADMIN_DECREE',
                        data: ['DISABLE_STORE_SSO_USERS', [!val]]
                    }, function (e, response) {
                        if (e || response.error) {
                            UI.warn(Messages.error);
                            console.error(e, response);
                        }
                        APP.updateStatus(function () {
                            setState(!APP.instanceStatus.dontStoreSSOUsers);
                            flushCacheNotice();
                        });
                    });
                },
            );
        }
        var button = blocks.button('primary', '', Messages.admin_usersAdd);
        var $b = $(button);

        var userAlias = blocks.input({
            type: 'text'
        });
        var blockAlias = blocks.labelledInput(Messages.admin_invitationAlias, userAlias);

        var userEmail = blocks.input({
            type: 'email'
        });
        var blockEmail = blocks.labelledInput(Messages.admin_invitationEmail, userEmail);

        var userEdPublic = blocks.input({
            type: 'key'
        });
        var blockEdPublic = blocks.labelledInput(Messages.admin_limitUser, userEdPublic);

        var userBlock = blocks.input({
            type: 'text'
        });
        var blockUser = blocks.labelledInput(Messages.admin_usersBlock, userBlock);


        var refreshUsers = function () {};
        var refreshButton = blocks.button('secondary', '', Messages.oo_refresh);
        Util.onClickEnter($(refreshButton), function () {
            refreshUsers();
        });
    
        var header = [
            Messages.admin_invitationAlias,
            Messages.admin_invitationEmail,
            Messages.admin_limitUser,
            Messages.admin_usersBlock,
            ""
        ];
        var list = blocks.table(header, []);
        var $list = $(list);
        
        var nav = blocks.nav([button, refreshButton]);

        var form = blocks.form([
            $invited,
            blockAlias,
            blockEmail,
            blockEdPublic,
            blockUser,
            list
        ], nav);
    
        var ssoEnabled = ApiConfig.sso && ApiConfig.sso.list && ApiConfig.sso.list.length;
        if(ssoEnabled){
            var $sso = blocks.checkbox('store-sso', '', !APP.instanceStatus.dontStoreSSOUsers, {}, function(checked) {
    
                    sFrameChan.query('Q_ADMIN_RPC', {
                        cmd: 'ADMIN_DECREE',
                        data: ['DISABLE_STORE_SSO_USERS', [!val]]
                    }, function (e, response) {
                        if (e || response.error) {
                            UI.warn(Messages.error);
                            console.error(e, response);
                        }
                        APP.updateStatus(function () {
                            setState(!APP.instanceStatus.dontStoreSSOUsers);
                            flushCacheNotice();
                        });
                    });
                },
            );
            form.append($sso);
        }

        var deleteUser = function (id) {
            sFrameChan.query('Q_ADMIN_RPC', {
                cmd: 'DELETE_KNOWN_USER',
                data: id
            }, function (e, response) {
                if (e || response.error) {
                    UI.warn(Messages.error);
                    return void console.error(e, response);
                }
                refreshUsers();
            });
        };
        var updateUser = function (key, changes) {
            sFrameChan.query('Q_ADMIN_RPC', {
                cmd: 'UPDATE_KNOWN_USER',
                data: {
                    edPublic: key,
                    changes: changes
                }
            }, function (e, response) {
                if (e || response.error) {
                    UI.warn(Messages.error);
                    return void console.error(e, response);
                }
                refreshUsers();
            });
        };
        refreshUsers = function () {
            $list.empty();
            sFrameChan.query('Q_ADMIN_RPC', {
                cmd: 'GET_ALL_USERS',
            }, function (e, response) {
                if (e || response.error) {
                    if (!response || response.error !== "ENOENT") { UI.warn(Messages.error); }
                    console.error(e, response);
                    return;
                }
                if (!Array.isArray(response)) { return; }
                var all = response[0];
                var newEntries = [];
                Object.keys(all).forEach(function (key) {
                    var data = all[key];
                    var editUser = () => {};
                    var del = blocks.button('danger', 'fa fa-trash', Messages.admin_usersRemove);
                    var $del = $(del);
                    Util.onClickEnter($del, function () {
                        $del.attr('disabled', 'disabled');
                        UI.confirm(Messages.admin_usersRemoveConfirm, function (yes) {
                            $del.attr('disabled', '');
                            if (!yes) { return; }
                            deleteUser(key);
                        });
                    });
                    var edit = blocks.button('secondary', 'fa fa-pencil', Messages.tag_edit);
                    Util.onClickEnter($(edit), function () {
                        editUser();
                    });

                    var alias = data.alias;
                    var $alias = $(alias);
                    var email = data.email;
                    var $email = $(email);
                    var actions = [edit, del];
                    var $actions = $(actions);

                    editUser = () => {
                        var aliasInput = h('input');
                        var emailInput = h('input');
                        $(aliasInput).val(data.alias);
                        $(emailInput).val(data.email);
                        var save = blocks.button('primary', '', Messages.settings_save);
                        var cancel = blocks.button('secondary', '', Messages.cancel);
                        Util.onClickEnter($(save), function () {
                            var aliasVal = $(aliasInput).val().trim();
                            if (!aliasVal) { return void UI.warn(Messages.error); }
                            var changes = {
                                alias: aliasVal,
                                email: $(emailInput).val().trim()
                            };
                            updateUser(key, changes);
                        });
                        Util.onClickEnter($(cancel), function () {
                            refreshUsers();
                        });
                        $alias.html('').append(aliasInput);
                        $email.html('').append(emailInput);
                        $actions.html('').append([save, cancel]);
                        console.warn(alias, email, $alias, $email, aliasInput);
                    };

                    var infoButton = blocks.button('primary.cp-report', 'fa fa-database', Messages.admin_diskUsageButton);
                    $(infoButton).click(() => {
                         getAccountData(key, (err, data) => {
                             if (err) { return void console.error(err); }
                             var table = renderAccountData(data);
                             UI.alert(table, () => {

                             }, {
                                wide: true,
                             });
                         });
                    });
                    newEntries.push([
                        UI.dialog.selectable(url),
                        data.alias,
                        data.email,
                        infoButton,
                        new Date(data.time).toLocaleString()
                        [edit, del]
                    ])
                });
                list.updateContent(newEntries);
            });
        };
        refreshUsers();
        $b.on('click', () => {
            var alias = $(userAlias).val().trim();
            if (!alias) { return void UI.warn(Messages.error); }
            $b.prop('disabled', true);

            var done = () => { $b.prop('disabled', false); };
            // TODO Get "block" from pin log?

            var keyStr = $(userEdPublic).val().trim();
            var edPublic = keyStr && Keys.canonicalize(keyStr);
            if (!edPublic) {
                done();
                return void UI.warn(Messages.admin_invalKey);
            }
            var block = getBlockId($(userBlock).val());

            var obj = {
                alias,
                email: $(userEmail).val(),
                block: block,
                edPublic: edPublic,
            };
            sFrameChan.query('Q_ADMIN_RPC', {
                cmd: 'ADD_KNOWN_USER',
                data: obj
            }, function (e, response) {
                done();
                if (e || response.error) {
                    UI.warn(Messages.error);
                    return void console.error(e, response);
                }
                $(userAlias).val('').focus();
                $(userEmail).val('');
                $(userBlock).val('');
                $(userEdPublic).val('');
                refreshUsers();
            });
        });

        cb(form);
       });


        //QUOTA
        //storage blocks
        sidebar.addItem('defaultlimit', function (cb) {

            var _limit = APP.instanceStatus.defaultStorageLimit;
            var _limitMB = Util.bytesToMegabytes(_limit);
            var limit = getPrettySize(_limit);

            // create input
            var newLimit = blocks.input({
                type: 'number',
                min: 0,
                value: _limitMB,
                'aria-labelledby': 'cp-admin-defaultlimit'
            });
            // create button
            var button = blocks.button('primary', '', Messages.admin_setlimitButton);
            var nav = blocks.nav([button]);
            // create current value text
            var text = blocks.text(Messages._getKey('admin_limit', [limit]));
            // add these items in a form
            var form = blocks.form([
                text,
                newLimit
            ], nav);

            // Add button handler
            UI.confirmButton(button, {
                classes: 'btn-primary',
                multiple: true,
                validate: function () {
                    var l = parseInt($(newLimit).val());
                    if (isNaN(l)) { return false; }
                    return true;
                }
            }, function () {
                var lMB = parseInt($(newLimit).val()); // Megabytes
                var l = lMB * 1024 * 1024; // Bytes
                var data = [l];
                sFrameChan.query('Q_ADMIN_RPC', {
                    cmd: 'ADMIN_DECREE',
                    data: ['UPDATE_DEFAULT_STORAGE', data]
                }, function (e, response) {
                    if (e || response.error) {
                        UI.warn(Messages.error);
                        return void console.error(e, response);
                    }
                    var limit = getPrettySize(l);
                    $(text).text(Messages._getKey('admin_limit', [limit]));
                });
            });

            cb(form);
        });

        sidebar.addItem('setlimit', function(cb){

            var userInput = blocks.input({
                type:'key'
            });
            var user = blocks.labelledInput(Messages.admin_limitUser, userInput);
            var $key = $(user);
            var limitInput = blocks.input({
                type: 'number',
                min: 0,
                value: 0
            });
            var limit = blocks.labelledInput(Messages.admin_limitMB, limitInput);
            var noteInput = blocks.input({
                type: 'text'
            });
            var note = blocks.labelledInput(Messages.admin_limitSetNote, noteInput);
            var $note = $(note);
            var remove = blocks.button('danger', '',Messages.fc_remove );
            var set = blocks.button('primary', '',  Messages.admin_setlimitButton);
            var nav = blocks.nav([set, remove]);
            var form = blocks.form([
                user,
                limit,
                note
            ], nav);
    
            var getValues = function () {
                var key = $key.val();
                var _limit = parseInt($(limit).val());
                if (key.length !== 44) {
                    try {
                        var u = Keys.parseUser(key);
                        if (!u.domain || !u.user || !u.pubkey) {
                            return void UI.warn(Messages.admin_invalKey);
                        }
                    } catch (e) {
                        return void UI.warn(Messages.admin_invalKey);
                    }
                }
                if (isNaN(_limit) || _limit < 0) {
                    return void UI.warn(Messages.admin_invalLimit);
                }
                var _note = ($note.val() || "").trim();
                return {
                    key: key,
                    data: {
                        limit: _limit * 1024 * 1024,
                        note: _note,
                        plan: 'custom'
                    }
                };
            };
            UI.confirmButton(remove, {
                classes: 'btn-danger',
                multiple: true,
                validate: function () {
                    var obj = getValues();
                    if (!obj || !obj.key) { return false; }
                    return true;
                }
            }, function () {
                var obj = getValues();
                var data = [obj.key];
                sFrameChan.query('Q_ADMIN_RPC', {
                    cmd: 'ADMIN_DECREE',
                    data: ['RM_QUOTA', data]
                }, function (e, response) {
                    if (e || response.error) {
                        UI.warn(Messages.error);
                        console.error(e, response);
                        return;
                    }
                    APP.refreshLimits();
                    $key.val('');
                });
            });
    
            $(set).click(function () {
                var obj = getValues();
                if (!obj || !obj.key) { return; }
                var data = [obj.key, obj.data];
                sFrameChan.query('Q_ADMIN_RPC', {
                    cmd: 'ADMIN_DECREE',
                    data: ['SET_QUOTA', data]
                }, function (e, response) {
                    if (e || response.error) {
                        UI.warn(Messages.error);
                        console.error(e, response);
                        return;
                    }
                    APP.refreshLimits();
                    $key.val('');
                    $note.val('');
                });
            });
            
            cb(form);
    
        });

        sidebar.addItem('getlimits', function(cb){
            // Make the empty table
            var header = [
                Messages.settings_publicSigningKey,
                Messages.admin_planlimit,
                Messages.admin_planName,
                Messages.admin_note
            ];
            var table = blocks.table(header, []);
          
            // Update the table content on each refresh
            APP.refreshLimits = function () {
                sFrameChan.query('Q_ADMIN_RPC', {
                    cmd: 'GET_LIMITS',
                }, function (e, data) {
                    if (e) { return; }
                    if (!Array.isArray(data) || !data[0]) { return; }

                    var obj = data[0];
                    if (obj && (obj.message || obj.location)) {
                        delete obj.message;
                        delete obj.location;
                    }
                    var list = Object.keys(obj).sort(function (a, b) {
                        return obj[a].limit > obj[b].limit;
                    });

                    var content = list.map(function (key) {
                        var user = obj[key];
                        var limit = getPrettySize(user.limit);
                        var title = Messages._getKey('admin_limit', [limit]) + ', ' +
                                    Messages._getKey('admin_limitPlan', [user.plan]) + ', ' +
                                    Messages._getKey('admin_limitNote', [user.note]);
                        var infoButton = blocks.button('primary.cp-report','',  Messages.admin_diskUsageButton);
                        $(infoButton).click(() => {
                             console.log(key);
                             getAccountData(key, (err, data) => {
                                 if (err) { return void console.error(err); }
                                 console.log(data);
                                 var table = renderAccountData(data);
                                 UI.alert(table, () => {

                                 }, {
                                    wide: true,
                                 });
                             });
                        });

                        var keyEl = h('code.cp-limit-key', key);
                        $(keyEl).click(function () {
                            $('.cp-admin-setlimit-form').find('.cp-setlimit-key').val(key);
                            $('.cp-admin-setlimit-form').find('.cp-setlimit-quota').val(Math.floor(user.limit / 1024 / 1024));
                            $('.cp-admin-setlimit-form').find('.cp-setlimit-note').val(user.note);
                        });

                        var attr = { title: title };
                      /*
                        return h('tr.cp-admin-limit', [
                            h('td', [
                                keyEl,
                                infoButton,
                            ]),
                            h('td.limit', attr, limit),
                            h('td.plan', attr, user.plan),
                            h('td.note', attr, user.note)
                        ]);
                      */
                      // XXX NOTE: update the blocks.table function to be able to pass "attributes" for each value 
                       var table = blocks.table()
                        return [
                            [keyEl, infoButton],
                            limit,
                            user.plan,
                            user.note
                          
                        ];
                    });
                    table.updateContent(content);
                });
            };
            APP.refreshLimits();
            cb(table);
        });

        //database
        var disable = $el => $el.attr('disabled', 'disabled');
        sidebar.addItem('account-metadata', function(cb){

            var input = blocks.input({
                type: 'text',
                placeholder: Messages.admin_accountMetadataPlaceholder,
                value: '',
            });
            var $input = $(input);

            var box = blocks.box(input, 'cp-admin-setter');

            var pending = false;
            var getInputState = function () {
                var val = $input.val().trim();
                var key = Keys.canonicalize(val);
                var state = {
                    value: val,
                    key: key,
                    valid: Boolean(key),
                    pending: pending,
                };
    
                return state;
            };

        var btn = blocks.button('primary', '', Messages.ui_generateReport);
        var $btn = $(btn);

        var nav = blocks.nav([btn]);
        var form = blocks.form([
            input,
            box
        ], nav);

        disable($btn);

        var setInterfaceState = function (state) {
            state = state || getInputState();
            var both = [$input, $btn];
            if (state.pending) {
                both.forEach(disable);
            } else if (state.valid) {
                both.forEach(enable);
            } else {
                enable($input);
                disable($btn);
            }
        };

        $input.on('keypress keyup change paste', function () {
            setTimeout(setInterfaceState);
        });

        $btn.click(function (/* ev */) {
            if (pending) { return; }
            var state = getInputState();
            if (!state.valid) {
                results.innerHTML = '';
                return void UI.warn(Messages.error);
            }
            var key = state.key;
            pending = true;
            setInterfaceState();

            getAccountData(key, (err, data) => {
                pending = false;
                setInterfaceState();
                if (!data) {
                    results.innerHTML = '';
                    return UI.warn(Messages.error);
                }
                var table = renderAccountData(data);
                results.innerHTML = '';
                results.appendChild(table);
                });
            });

            cb(form);
    
        });

        sidebar.addItem('document-metadata', function(cb){
            var input = blocks.input({
                type: 'text',
                placeholder: Messages.admin_documentMetadataPlaceholder,
                value: ''
            });
            var $input = $(input);
            var passwordContainer = UI.passwordInput({
                id: 'cp-database-document-pw',
                placeholder: Messages.login_password,
            });
            var $passwordContainer = $(passwordContainer);
            var getBlobId = pathname => {
                var parts;
                try {
                    if (typeof(pathname) !== 'string') { return; }
                    parts = pathname.split('/').filter(Boolean);
                    if (parts.length !== 3) { return; }
                    if (parts[0] !== 'blob') { return; }
                    if (parts[1].length !== 2) { return; }
                    if (parts[2].length !== 48) { return; }
                    if (!parts[2].startsWith(parts[1])) { return; }
                } catch (err) { return false; }
                return parts[2];
            };
    
            var pending = false;
            var getInputState = function () {
                var val = $input.val().trim();
                var state = {
                    valid: false,
                    passwordRequired: false,
                    id: undefined,
                    input: val,
                    password: $password.val().trim(),
                    pending: false,
                };
    
                if (!val) { return state; }
                if (isHex(val) && [32, 48].includes(val.length)) {
                    state.valid = true;
                    state.id = val;
                    return state;
                }
    
                var url;
                try {
                    url = new URL(val, ApiConfig.httpUnsafeOrigin);
                } catch (err) {}
    
                if (!url) { return state; } // invalid
    
                // recognize URLs of the form: /blob/f1/f1338921fe8a73ed5401780d2147f725deeb9e3329f0f01e
                var blobId = getBlobId(url.pathname);
                if (blobId) {
                    state.valid = true;
                    state.id = blobId;
                    return state;
                }
    
                var parsed = Hash.isValidHref(val);
                if (!parsed || !parsed.hashData) { return state; }
                if (parsed.hashData.version === 3) {
                    state.id = parsed.hashData.channel;
                    state.valid = true;
                    return state;
                }
    
                var secret;
                if (parsed.hashData.password) {
                    state.passwordRequired = true;
                    secret = Hash.getSecrets(parsed.type, parsed.hash, state.password);
                } else {
                    secret = Hash.getSecrets(parsed.type, parsed.hash);
                }
                if (secret && secret.channel) {
                    state.id = secret.channel;
                    state.valid = true;
                    return state;
                }
                return state;
            };
    
            $passwordContainer.hide();
        
            var btn = blocks.button('primary', '', Messages.ui_generateReport);
            var $btn = $(btn);
            disable($btn);
            var nav = blocks.nav([btn]);
            var form = blocks.form([
                input, 
                passwordContainer
            ], nav);
            var setInterfaceState = function () {
                var state = getInputState();
                var all = [ $btn, $password, $input ];
                var text = [$password, $input];
    
                if (state.pending) {
                    all.forEach(disable);
                } else if (state.valid) {
                    all.forEach(enable);
                } else {
                    text.forEach(enable);
                    disable($btn);
                }
                if (state.passwordRequired) {
                    $passwordContainer.show();
                } else {
                    $passwordContainer.hide();
                }
            };
    
            $input.on('keypress keyup change paste', function () {
                setTimeout(setInterfaceState);
            });
    
            $btn.click(function () {
                if (pending) { return; }
                pending = true;
                var state = getInputState();
                setInterfaceState(state);
                getDocumentData(state.id, function (err, data) {
                    pending = false;
                    setInterfaceState();
                    if (err) {
                        results.innerHTML = '';
                        return void UI.warn(err);
                    }
    
                    var table = renderDocumentData(data);
                    results.innerHTML = '';
                    results.appendChild(table);
                });
            });
    
            cb(form);
        });

        var enable = $el => $el.removeAttr('disabled');
        sidebar.addItem('block-metadata', function(cb){
            var input = blocks.input({
                type: 'text',
                placeholder: Messages.admin_blockMetadataPlaceholder,
                value: ''
            });
            var $input = $(input);
            var btn = blocks.button('primary', '', Messages.ui_generateReport);
            var $btn = $(btn);
            disable($btn);

            var nav = blocks.nav([btn]);
            var form = blocks.form([
                input
            ], nav);
            var pending = false;
            var getInputState = function () {
                var val = $input.val().trim();
                var state = {
                    pending: pending,
                    valid: false,
                    value: val,
                    key: '',
                };

                var key = getBlockId(val);
                if (key) {
                    state.valid = true;
                    state.key = key;
                }
                return state;
            };
            var setInterfaceState = function () {
                var state = getInputState();
                var all = [$btn, $input];

                if (state.pending) {
                    all.forEach(disable);
                } else if (state.valid) {
                    all.forEach(enable);
                } else {
                    enable($input);
                    disable($btn);
                }
            };

            $input.on('keypress keyup change paste', function () {
                setTimeout(setInterfaceState);
            });

            $btn.click(function () {
                if (pending) { return; }
                var state = getInputState();
                pending = true;
                setInterfaceState();
                getBlockData(state.key, (err, data) => {
                    pending = false;
                    setInterfaceState();
                    if (err || !data) {
                        results.innerHTML = '';
                        console.log(err, data);
                        return UI.warn(Messages.error);
                    }
                    var table = renderBlockData(data);
                    results.innerHTML = '';
                    results.appendChild(table);
                });
            });

            cb(form);

            });
        
        sidebar.addItem('totp-recovery', function(cb){
            var textarea = blocks.textArea({
                id: 'textarea-input',
                'aria-labelledby': 'cp-admin-totp-recovery'
            });
            var $input = $(textarea);
            var btn = blocks.button('primary','', Messages.admin_totpDisable);
            var $btn = $(btn);
            disable($btn);
            var nav = blocks.nav([btn]);
            var form = blocks.form([
                textarea
            ], nav);

            var pending = false;
            var getInputState = function () {
                var val = $input.val().trim();
                var state = {
                    pending: pending,
                    value: undefined,
                    key: '',
                };

                var json;
                try { json = JSON.parse(val); } catch (err) { }
                if (!json || json.intent !== "Disable TOTP" || !json.blockId || json.blockId.length !== 44 ||
                !json.date || !json.proof) { return state; }

                state.value = json;
                state.key = json.blockId.replace(/\//g, '-');
                return state;
            };
            var setInterfaceState = function () {
                var state = getInputState();
                var all = [$btn, $input];
    
                if (state.pending) {
                    all.forEach(disable);
                } else {
                    all.forEach(enable);
                }
            };
    
            setInterfaceState();
            $btn.click(function () {
                if (pending) { return; }
                var state = getInputState();
                if (!state.value) { return; }
                pending = true;
                setInterfaceState();
                getBlockData(state.key, (err, data) => {
                    pending = false;
                    setInterfaceState();
                    console.warn(data);
                    if (err || !data) {
                        results.innerHTML = '';
                        console.log(err, data);
                        return UI.warn(Messages.error);
                    }
                    var check = checkTOTPRequest(state.value);
                    if (!check) { UI.warn(Messages.admin_totpFailed); }
                    data.totpCheck = check;
                    var table = renderTOTPData(data);
                    results.innerHTML = '';
                    results.appendChild(table);
                });
            });
    
            cb(form);

        });

        //stats
        sidebar.addItem('refresh-stats', function(cb){
            var btn = blocks.button('primary', '',  Messages.oo_refresh);
            var $btn = $(btn);
            $btn.click(function () {
                onRefreshStats.fire();
            });
            cb(btn);
        },
        {
        noTitle: true,
        noHint: true 
        });

        var onRefreshStats = Util.mkEvent();
    sidebar.addItem('uptime', function(cb){

            var pre = blocks.pre(Messages.admin_uptimeTitle);
            var set = function () {
                var uptime = APP.instanceStatus.launchTime;
                if (typeof(uptime) !== 'number') { return; }
                pre.innerText = new Date(uptime);
            };
            
            set();
            onRefreshStats.reg(function () {
                APP.updateStatus(set);
            });
            cb(pre);
            });
        
            sidebar.addItem('active-sessions', function(cb){
                var pre = blocks.pre('');
                var onRefresh = function () {
                    sFrameChan.query('Q_ADMIN_RPC', {
                        cmd: 'ACTIVE_SESSIONS',
                    }, function (e, data) {
                        var total = data[0];
                        var ips = data[1];
                        pre.append(total + ' (' + ips + ')');
                    });
                };
                onRefresh();
                onRefreshStats.reg(onRefresh);
                cb(pre);
            });

            sidebar.addItem('active-pads', function(cb){
                var pre = blocks.pre('');
                var onRefresh = function () {
                    sFrameChan.query('Q_ADMIN_RPC', {
                        cmd: 'ACTIVE_PADS',
                    }, function (e, data) {
                        pre.append(String(data));
                    });
                };
                onRefresh();
                onRefreshStats.reg(onRefresh);
                cb(pre);
            });

            sidebar.addItem('open-files', function(cb){
                var pre = blocks.pre('');
                var onRefresh = function () {
                    sFrameChan.query('Q_ADMIN_RPC', {
                        cmd: 'GET_FILE_DESCRIPTOR_COUNT',
                    }, function (e, data) {
                        if (e || (data && data.error)) {
                            console.error(e, data);
                            pre.append(String(e || data.error));
                            return;
                        }
                        pre.append(String(data));
                    });
                };
                onRefresh();
                onRefreshStats.reg(onRefresh);
                cb(pre);
            });

            sidebar.addItem('registered', function(cb){
                var pre = blocks.pre('');
                var onRefresh = function () {
                    sFrameChan.query('Q_ADMIN_RPC', {
                        cmd: 'REGISTERED_USERS',
                    }, function (e, data) {
                        pre.append(String(data));
                    });
                };
                onRefresh();
                onRefreshStats.reg(onRefresh);
                cb(pre);
            });

           //TODO create list
           sidebar.addItem('disk-usage', function(cb){
            var called = false;
            var button = blocks.button('primary', '', Messages.admin_diskUsageButton);
            var nav = blocks.nav([button]);
            var list = blocks.unorderedList([]);
            var entries = [];
            var form = blocks.form([
                list
            ], nav);
            var $button = $(button);

            form.updateContent = function(newList) {
                $(list).empty(); // Clear existing content
                $(list).append(newList); // Append the new list
            };

            $button.click(function () {
                UI.confirm(Messages.admin_diskUsageWarning, function (yes) {
                    if (!yes) { return; }
                    $button.hide();
                    if (called) { return; }
                    called = true;
                    sFrameChan.query('Q_ADMIN_RPC', {
                        cmd: 'DISK_USAGE',
                    }, function (e, data) {
                        console.log(e, data);
                        if (e) { return void console.error(e); }
                        var obj = data[0];
                        Object.keys(obj).forEach(function (key) {
                            var val = obj[key];
                            var unit = Util.magnitudeOfBytes(val);
                            if (unit === 'GB') {
                                obj[key] = Util.bytesToGigabytes(val) + ' GB';
                            } else if (unit === 'MB') {
                                obj[key] = Util.bytesToMegabytes(val) + ' MB';
                            } else {
                                obj[key] = Util.bytesToKilobytes(val) + ' KB';
                            }
                        });
                        entries = Object.keys(obj).map(function (k) {
                            return [
                                (k === 'total' ? k : '/' + k),
                                ' : ',
                                obj[k]
                            ];
                        });
                        var newList = blocks.unorderedList(entries);
                        form.updateContent(newList); // Update the content of the form with the new unordered list
                    });
                    
                });
            });
            cb(form);
        });
        

        
        sidebar.makeLeftside(categories);
    };

    

    var updateStatus = APP.updateStatus = function (cb) {
        sFrameChan.query('Q_ADMIN_RPC', {
            cmd: 'INSTANCE_STATUS',
        }, function (e, data) {
            if (e) { console.error(e); return void cb(e); }
            if (!Array.isArray(data)) { return void cb('EINVAL'); }
            APP.instanceStatus = data[0];
            console.log("Status", APP.instanceStatus);
            cb();
        });
    };

    var createToolbar = function () {
        var displayed = ['useradmin', 'newpad', 'limit', 'pageTitle', 'notifications'];
        var configTb = {
            displayed: displayed,
            sfCommon: common,
            $container: APP.$toolbar,
            pageTitle: Messages.adminPage || 'Admin',
            metadataMgr: common.getMetadataMgr(),
        };
        APP.toolbar = Toolbar.create(configTb);
        APP.toolbar.$rightside.hide();
    };

    nThen(function(waitFor) {
        $(waitFor(UI.addLoadingScreen));
        SFCommon.create(waitFor(function(c) { APP.common = common = c; }));
    }).nThen(function(waitFor) {
        APP.$container = $('#cp-sidebarlayout-container');
        APP.$toolbar = $('#cp-toolbar');
        sFrameChan = common.getSframeChannel();
        sFrameChan.onReady(waitFor());
    }).nThen(function (waitFor) {
        if (!common.isAdmin()) { return; }
        updateStatus(waitFor());
    }).nThen(function( /*waitFor*/ ) {
        metadataMgr = common.getMetadataMgr();
        privateData = metadataMgr.getPrivateData();
        common.setTabTitle(Messages.adminPage || 'Administration');

        if (!common.isAdmin()) {
            return void UI.errorLoadingScreen(Messages.admin_authError || '403 Forbidden');
        }

        // Add toolbar
        createToolbar();

        // Content
        andThen(common, APP.$container);

        common.setTabTitle(Messages.settings_title);
        UI.removeLoadingScreen();
    });
});

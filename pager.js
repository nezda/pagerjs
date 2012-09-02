var pager = {};

// common KnockoutJS helpers
var _ko = {};

_ko.value = ko.utils.unwrapObservable;

_ko.arrayValue = function (arr) {
    return _.map(arr, function (e) {
        return _ko.value(e);
    });
};

/**
 * @class pager.ChildManager
 */

/**
 *
 * @param {pager.Page[]} children
 * @param {pager.Page} page
 * @constructor
 */
pager.ChildManager = function (children, page) {

    this.currentChildO = ko.observable(null);
    var me = this;
    this.page = page;

    this.hideChild = function () {
        if (me.currentChild) {
            if (me.currentChild.getId() !== 'start') {
                me.currentChild.hidePage(function () {
                });
                me.currentChild = null;
                me.currentChildO(null);
            }
        }
    };

    /**
     *
     * @param {String[]} route
     */
    this.showChild = function (route) {
        var oldCurrentChild = me.currentChild;
        me.currentChild = null;
        var match = false;
        var currentRoute = route[0];
        var wildcard = null;
        _.each(children(), function (child) {
            if (!match) {
                var id = child.getId();
                if (id === currentRoute ||
                    ((currentRoute === '' || currentRoute == null) && id === 'start')) {
                    match = true;
                    me.currentChild = child;
                }
                if (id === '?') {
                    wildcard = child;
                }
            }
        });
        // find modals in parent - but only if 1) no match is found, 2) this page got a parent and 3) this page is not a modal!
        var isModal = false;

        var currentChildManager = me;

        while (!me.currentChild && currentChildManager.page.parentPage && !currentChildManager.page.getValue().modal) {
            var parentChildren = currentChildManager.page.parentPage.children;
            _.each(parentChildren(), function (child) {
                if (!match) {
                    var id = child.getId();
                    var modal = child.getValue().modal;
                    if (modal) {
                        if (id === currentRoute ||
                            ((currentRoute === '' || currentRoute == null) && id === 'start')) {
                            match = true;
                            me.currentChild = child;
                            isModal = true;
                        }
                        if (id === '?' && !wildcard) {
                            wildcard = child;
                            isModal = true;
                        }
                    }
                }
            });
            if (!me.currentChild) {
                currentChildManager = currentChildManager.page.parentPage.childManager;
            }
        }

        if (!me.currentChild && wildcard) {
            me.currentChild = wildcard;
            me.currentChild.currentId = currentRoute;
        }
        if (me.currentChild) {
            me.currentChildO(me.currentChild);

            if (isModal) {
                me.currentChild.currentParentPage(me.page);
            } else {
                me.currentChild.currentParentPage(null);
            }

        }

        var onFailed = function () {
            if (pager.navigationFailed) {
                pager.navigationFailed(me.page, route);
            }
            if (me.page.getValue().navigationFailed) {
                _ko.value(me.page.getValue().navigationFailed)(me.page, route);
            }
        };

        if (oldCurrentChild && oldCurrentChild === me.currentChild) {
            me.currentChild.showPage(route.slice(1));
        } else if (oldCurrentChild) {
            oldCurrentChild.hidePage(function () {
                if (me.currentChild) {
                    me.currentChild.showPage(route.slice(1));
                } else {
                    onFailed();
                }
            });
        } else if (me.currentChild) {
            me.currentChild.showPage(route.slice(1));
        } else {
            onFailed();
        }
    };
};

/**
 */
pager.start = function () {

    var onHashChange = function () {
        pager.routeFromHashToPage(window.location.hash);
    };
    $(window).bind('hashchange', onHashChange);
    onHashChange();
};

/**
 *
 * @param viewModel
 */
pager.extendWithPage = function (viewModel) {
    viewModel.$__page__ = new pager.Page();

    pager.childManager = new pager.ChildManager(viewModel.$__page__.children, viewModel.$__page__);
    viewModel.$__page__.childManager = pager.childManager;
};

/**
 *
 * Called when a route does not find a match.
 *
 * @type {Function}
 */
pager.navigationFailed = null;


/**
 *
 * @param {String} hash
 */
pager.routeFromHashToPage = function (hash) {
    // skip #
    if (hash[0] === '#') {
        hash = hash.slice(1);
    }
    // split on '/'
    var hashRoute = decodeURIComponent(hash).split('/');

    pager.childManager.showChild(hashRoute);

};

/**
 * @class pager.Page
 */

/**
 * @param {Node} element
 * @param {Observable} valueAccessor
 * @param allBindingsAccessor
 * @param {Observable} viewModel
 * @param bindingContext
 * @constructor
 */
pager.Page = function (element, valueAccessor, allBindingsAccessor, viewModel, bindingContext) {
    /**
     *
     * @type {Node}
     */
    this.element = element;
    /**
     *
     * @type {Observable}
     */
    this.valueAccessor = valueAccessor;
    /**
     *
     * @type {*}
     */
    this.allBindingsAccessor = allBindingsAccessor;
    /**
     *
     * @type {Observable}
     */
    this.viewModel = viewModel;
    /**
     *
     * @type {*}
     */
    this.bindingContext = bindingContext;

    /**
     *
     * @type {ObservableArray}
     */
    this.children = ko.observableArray([]);

    /**
     *
     * @type {pager.ChildManager}
     */
    this.childManager = new pager.ChildManager(this.children, this);
    /**
     *
     * @type {pager.Page}
     */
    this.parentPage = null;
    /**
     *
     * @type {String}
     */
    this.currentId = null;

    /**
     *
     * @type {Observable/pager.Page}
     */
    this.currentParentPage = ko.observable(null);


    /**
     *
     * @type {Observable}
     */
    this.isVisible = ko.observable(false);
};

/**
 * @method showPage
 * @param route
 */
pager.Page.prototype.showPage = function (route) {
    this.isVisible(true);
    this.show();
    this.childManager.showChild(route);
};

/**
 * @method hidePage
 * @param {Function} callback
 */
pager.Page.prototype.hidePage = function (callback) {
    this.isVisible(false);
    this.hideElementWrapper(callback);
    this.childManager.hideChild();
};

/**
 * @method init
 * @return {Object}
 */
pager.Page.prototype.init = function () {

    var value = this.getValue();
    this.parentPage = this.getParentPage();
    this.parentPage.children.push(this);


    this.hideElement();

    // Fetch source
    if (value.source) {
        this.loadSource(value.source);
    }

    var ctx = null;
    if (value['with']) {
        ctx = _ko.value(value['with']);
    } else if (value['withOnShow']) {
        ctx = {};
    } else {
        ctx = this.viewModel;
    }
    this.childBindingContext = this.bindingContext.createChildContext(ctx);
    ko.utils.extend(this.childBindingContext, {$page:this});
    if (!value['withOnShow']) {
        ko.applyBindingsToDescendants(this.childBindingContext, this.element);
    }
    return { controlsDescendantBindings:true};
};

/**
 * @method getValue
 * @returns {Object} value
 */
pager.Page.prototype.getValue = function () {
    if (this.valueAccessor) {
        return _ko.value(this.valueAccessor());
    } else {
        return {};
    }
};

/**
 * @method pager.Page#getParentPage
 * @return {pager.Page}
 */
pager.Page.prototype.getParentPage = function () {
    // search this context/$data until either root is accessed or no page is found
    var bindingContext = this.bindingContext;
    while(bindingContext) {
        if(bindingContext.$page) {
            return bindingContext.$page;
        } else if(bindingContext.$data && bindingContext.$data.$__page__) {
            return bindingContext.$data.$__page__;
        }
        bindingContext = bindingContext.$parentContext;
    }
    return null;
};

/**
 * @method pager.Page#getId
 * @return String
 */
pager.Page.prototype.getId = function () {
    return _ko.value(this.getValue().id);
};


/**
 *
 * @param {Observable/String} source
 * @return {Observable}
 */
pager.Page.prototype.sourceUrl = function (source) {
    var me = this;
    if (this.getId() === '?') {
        return ko.computed(function () {
            // TODO: maybe make currentId an ko.observable?
            return _ko.value(source).replace('{1}', me.currentId);
        });
    } else {
        return ko.computed(function () {
            return _ko.value(source);
        });
    }
};

/**
 * @method loadSource
 * @param source
 */
pager.Page.prototype.loadSource = function (source) {
    var value = this.getValue();
    var me = this;
    var element = this.element;
    var loader = null;
    var loaderMethod = value.loader || pager.loader;
    if (value.frame === 'iframe') {
        var iframe = $('iframe', $(element));
        if (iframe.length === 0) {
            iframe = $('<iframe></iframe>');
            $(element).append(iframe);
        }
        if (loaderMethod) {
            loader = _ko.value(loaderMethod)(me, iframe);
            loader.load();
        }
        if (value.sourceLoaded) {
            iframe.one('load', function () {
                if (loader) {
                    loader.unload();
                }
                value.sourceLoaded();
            });
        }
        // TODO: remove src binding and add this binding
        ko.applyBindingsToNode(iframe[0], {
            attr:{
                src:this.sourceUrl(source)
            }
        });
    } else {
        if (loaderMethod) {
            loader = _ko.value(loaderMethod)(me, me.element);
            loader.load();
        }
        // TODO: remove all children and add sourceUrl(source)
        ko.computed(function () {
            var s = _ko.value(this.sourceUrl(source));
            $(element).load(s, function () {
                if (loader) {
                    loader.unload();
                }
                ko.applyBindingsToDescendants(me.childBindingContext, me.element);
                if (value.sourceLoaded) {
                    value.sourceLoaded.apply(me, arguments);
                }
            });
        }, this);
    }
};

/**
 * @method pager.Page#show
 * @param {Function} callback
 */
pager.Page.prototype.show = function (callback) {
    var element = this.element;
    var value = this.getValue();
    this.showElementWrapper(callback);
    if (this.getValue().title) {
        window.document.title = this.getValue().title;
    }
    if (value.withOnShow) {
        if (!this.withOnShowLoaded) {
            this.withOnShowLoaded = true;
            value.withOnShow(_.bind(function (vm) {
                var childBindingContext = this.bindingContext.createChildContext(vm);

                ko.utils.extend(childBindingContext, {$page:this});
                ko.applyBindingsToDescendants(childBindingContext, this.element);
            }, this));
        }
    }

    // Fetch source
    if (value.sourceOnShow) {
        if (!value.sourceCache ||
            !element.__pagerLoaded__ ||
            (typeof(value.sourceCache) === 'number' && element.__pagerLoaded__ + value.sourceCache * 1000 < Date.now())) {
            element.__pagerLoaded__ = Date.now();
            this.loadSource(value.sourceOnShow);
        }
    }
};

/**
 * @method pager.Page#showElementWrapper
 * @param {Function} callback
 */
pager.Page.prototype.showElementWrapper = function (callback) {
    if (this.getValue().beforeShow) {
        this.getValue().beforeShow(this);
    }
    this.showElement(callback);
    if (this.getValue().afterShow) {
        this.getValue().afterShow(this);
    }
};

/**
 * @method showElement
 * @param {Function} callback
 */
pager.Page.prototype.showElement = function (callback) {
    if (this.getValue().showElement) {
        this.getValue().showElement(this, callback);
    } else if (pager.showElement) {
        pager.showElement(this, callback);
    } else {
        $(this.element).show(callback);
    }
};

/**
 *
 * @param {Function} callback
 */
pager.Page.prototype.hideElementWrapper = function (callback) {
    if (this.getValue().beforeHide) {
        this.getValue().beforeHide(this);
    }
    this.hideElement(callback);
    if (this.getValue().afterHide) {
        this.getValue().afterHide(this);
    }
};

/**
 *
 * @param {Function} callback
 */
pager.Page.prototype.hideElement = function (callback) {
    if (this.getValue().hideElement) {
        this.getValue().hideElement(this, callback);
    } else if (pager.hideElement) {
        pager.hideElement(this, callback);
    } else {
        $(this.element).hide();
        if (callback) {
            callback();
        }
    }
};


/**
 *
 * @return {Observable}
 */
pager.Page.prototype.getFullRoute = function () {
    return ko.computed(function () {
        var res = null;
        if (this.currentParentPage && this.currentParentPage()) {
            res = this.currentParentPage().getFullRoute()();
            res.push(this.getId());
            return res;
        } else if (this.parentPage) {
            res = this.parentPage.getFullRoute()();
            res.push(this.getId());
            return res;
        } else { // is root page
            return [];
        }
    }, this);
};

ko.bindingHandlers.page = {
    init:function (element, valueAccessor, allBindingsAccessor, viewModel, bindingContext) {
        var page = new pager.Page(element, valueAccessor, allBindingsAccessor, viewModel, bindingContext);
        return page.init();
    },
    update:function (element, valueAccessor, allBindingsAccessor, viewModel, bindingContext) {
    }
};

// page-href

/**
 *
 * @type {Boolean}
 */
pager.useHTML5history = false;
/**
 *
 * @type {String}
 */
pager.rootURI = '/';

// TODO: extract this into a separate class pager.PageHref
ko.bindingHandlers['page-href'] = {
    init:function (element, valueAccessor, allBindingsAccessor, viewModel, bindingContext) {
        var $page = bindingContext.$page || bindingContext.$data.$page;
        var page = $page;

        // The href reacts to changes in the value
        var path = ko.computed(function () {
            var value = _ko.value(valueAccessor());
            var parentsToTrim = 0;
            while (value.substring(0, 3) === '../') {
                parentsToTrim++;
                value = value.slice(3);
            }

            var fullRoute = page.getFullRoute()();
            var parentPath = fullRoute.slice(0, fullRoute.length - parentsToTrim).join('/');
            var fullPath = (parentPath === '' ? '' : parentPath + '/') + value;
            var attr = {
                'href':'#' + fullPath
            };
            $(element).attr(attr);
            return fullPath;
        });

        if (pager.useHTML5history && window.history && history.pushState) {
            $(element).click(function (e) {
                e.preventDefault();
                history.pushState(null, null, pager.rootURI + path());
                pager.childManager.showChild(path().split('/'));

            });
        }


    },
    update:function () {
    }
};

/**
 * @class pager.PageAccordionItem
 * @inherits pager.Page
 */

/**
 *
 * @param {Node} element
 * @param {Observable} valueAccessor
 * @param allBindingsAccessor
 * @param {Observable} viewModel
 * @param bindingContext
 * @constructor
 */
pager.PageAccordionItem = function (element, valueAccessor, allBindingsAccessor, viewModel, bindingContext) {
    pager.Page.apply(this, arguments);
};

pager.PageAccordionItem.prototype = new pager.Page();

/**
 *
 * @return {Node}
 */
pager.PageAccordionItem.prototype.getAccordionBody = function () {
    return $(this.element).children()[1];
};

pager.PageAccordionItem.prototype.hideElement = function (callback) {
    if (!this.pageAccordionItemHidden) {
        this.pageAccordionItemHidden = true;
        $(this.getAccordionBody()).hide();
    } else {
        $(this.getAccordionBody()).slideUp();
        if (callback) {
            callback();
        }
    }
};

pager.PageAccordionItem.prototype.showElement = function (callback) {
    $(this.getAccordionBody()).slideDown();
    if (callback) {
        callback();
    }
};

ko.bindingHandlers['page-accordion-item'] = {
    init:function (element, valueAccessor, allBindingsAccessor, viewModel, bindingContext) {
        var pageAccordionItem = new pager.PageAccordionItem(element, valueAccessor, allBindingsAccessor, viewModel, bindingContext);
        pageAccordionItem.init();
    },
    update:function () {
    }
};